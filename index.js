const app = require("express")();

let chrome = {};
let puppeteer;

if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
  chrome = require("chrome-aws-lambda");
  puppeteer = require("puppeteer-core");
} else {
  puppeteer = require("puppeteer");
}

app.get("/api", async (req, res) => {
  const url = req.query.url;

  let options = {};

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    options = {
      args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chrome.defaultViewport,
      executablePath: await chrome.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    };
  }

  try {
    let Chats;
    const browser = await puppeteer.launch(options);
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(true);
    await page.goto(url);

    let title = await page.evaluate(() => document.title);

    if (title === "404: This page could not be found") {
      return new Error("Not Found");
    } else {
      Chats = await page.evaluate(() => {
        const OuterGroupDiv = Array.from(
          document.querySelectorAll(
            "#__next > div.overflow-hidden.w-full.h-full.relative.flex.z-0 > div > div > main > div.flex-1.overflow-hidden > div > div > div.group"
          )
        );

        let resultChats = [];

        for (let i = 0; i < OuterGroupDiv.length; i += 2) {
          const question = OuterGroupDiv[i]
            .querySelector("div > div:nth-child(2) > div > div")
            .innerText.toString();

          const answer = OuterGroupDiv[i + 1].querySelector(
            "div > div:nth-child(2) > div > div > div"
          ).innerHTML;

          resultChats.push({ question, answer });
        }

        return resultChats;
      });
    }

    await browser.close();

    res.status(201).json({ title, Chats });
  } catch (err) {
    console.error(err);
    res.status(500).json("something gone wrong");
  }
});

app.listen(process.env.PORT || 3300, () => {
  console.log("Server started");
});

module.exports = app;
