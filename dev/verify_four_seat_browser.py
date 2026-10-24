"""Browser 4-client GUI regression for the local 4-seat lab.

Requirements: Python 3.10+, playwright, Chromium.
No network or Firebase used. All sources are bundled in memory for testing only.
Run: python dev/verify_four_seat_browser.py
"""
import asyncio
import html
import os
import pathlib
import random
import re
import time
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]


def inline_source():
    doc = (ROOT / "online/four-seat-lab.html").read_text()
    games = (ROOT / "games.mjs").read_text()
    room = (ROOT / "online/four-seat-authority.mjs").read_text()
    names = re.findall(r"^export (?:function|const) (\w+)", games, re.M)
    assert names and "import * as G from '../games.mjs';" in room
    games = games.replace("export ", "")
    room = room.replace("import * as G from '../games.mjs';",
                        "const G = {" + ",".join(names) + "};").replace("export ", "")
    anchor = "import {createFourSeatAuthority,makeFourSeatCommand,FOUR_ROOM_PROTOCOL} from './four-seat-authority.mjs';"
    assert anchor in doc
    return doc.replace(anchor, games + "\n" + room).replace('<script type="module">', "<script>")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=os.environ.get("CHROME_PATH", "/usr/bin/chromium"),
            headless=True, args=["--no-sandbox"])
        try:
            page = await browser.new_page(viewport={"width": 1050, "height": 840})
            frame_doc = html.escape(inline_source(), quote=True)
            page_doc = '<!doctype html><html><body style="display:grid;grid-template-columns:repeat(2,1fr)">' + ''.join(
                f'<iframe id="f{i}" srcdoc="{frame_doc}" style="width:500px;height:400px"></iframe>'
                for i in range(4)) + '</body></html>'
            errors = []
            page.on("pageerror", lambda err: errors.append(str(err)))
            await page.set_content(page_doc)
            clients = page.frames[1:]
            assert len(clients) == 4
            for frame in clients:
                await frame.wait_for_function("!!window.TCFourLab")

            for game, code in [("babanuki", "72651"), ("shichinarabe", "72652"), ("daifugo", "72653")]:
                await clients[0].evaluate("([c,g])=>TCFourLab.makeRoom(c,g)", [code, game])
                for client in clients[1:]:
                    await client.evaluate("([c,g])=>TCFourLab.joinRoom(c,g)", [code, game])
                await clients[0].wait_for_function("TCFourLab.publicView?.seats?.every(s=>s.present)")
                for i, client in enumerate(clients):
                    await client.wait_for_function("TCFourLab.publicView?.seats?.every(s=>s.present)")
                    await client.wait_for_function("(p)=>TCFourLab.privateView?.seat===p", arg=i)
                    await client.evaluate("TCFourLab.action('ready',{ready:true})")
                    await clients[0].wait_for_function("(i)=>TCFourLab.publicView.seats[i].ready", arg=i)
                await clients[0].evaluate("TCFourLab.action('start')")
                await clients[0].wait_for_function("TCFourLab.publicView.phase==='playing'")
                moves, rng = 0, random.Random(35)
                started = time.time()
                while True:
                    view = await clients[0].evaluate("TCFourLab.publicView")
                    if view["phase"] == "finished":
                        break
                    assert view["phase"] == "playing"
                    seat = view["turn"]
                    client = clients[seat]
                    await client.wait_for_function(
                        "(n)=>TCFourLab.publicView?.revision>=n&&TCFourLab.privateView?.revision>=n",
                        arg=view["revision"])
                    private = await client.evaluate("TCFourLab.privateView")
                    assert private["seat"] == seat
                    if game == "babanuki":
                        typ, extra = "draw", {"index": rng.randrange(view["counts"][view["drawFrom"]])}
                    elif game == "shichinarabe":
                        ids = private["legalIds"]
                        typ, extra = ("play", {"id": ids[0]}) if ids else ("pass", {})
                    else:
                        moves_list = private["legalMoves"]
                        typ, extra = ("play", {"ids": moves_list[0]}) if moves_list else ("pass", {})
                    await client.evaluate("([t,a])=>TCFourLab.action(t,a)", [typ, extra])
                    await clients[0].wait_for_function(
                        "(n)=>TCFourLab.publicView.revision>n", arg=view["revision"])
                    moves += 1
                    assert moves < 1800, "Match did not finish"

                ranks = await clients[0].evaluate("TCFourLab.publicView.ranks")
                assert sorted(ranks.values()) == [1, 2, 3, 4]
                for client in clients:
                    await client.wait_for_function("TCFourLab.publicView?.phase==='finished'")
                    assert await client.evaluate("TCFourLab.publicView.ranks") == ranks
                await clients[0].evaluate("TCFourLab.action('rematch')")
                await clients[0].wait_for_function("TCFourLab.publicView.phase==='lobby'")
                assert await clients[0].evaluate("TCFourLab.publicView.round") == 1
                print(game, "browser full match:", moves, "moves", round(time.time()-started, 2), "seconds")

            assert not errors, errors
            print("ALL THREE BROWSER MATCHES PASS / page errors 0")
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
