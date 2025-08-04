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
      throw new Error("Not Found");
    } else {
      Chats = await page.evaluate(() => {
        const OuterGroupDiv = Array.from(
          document.querySelectorAll(
            "div.text-base.my-auto.mx-auto.pb-10 div.agent-turn"
          )
        );

        let resultChats = [];

        for (let i = 0; i < OuterGroupDiv.length; i += 2) {
          const questionElement = OuterGroupDiv[i]?.querySelector(
            "div[data-message-author-role='user'] div.markdown.prose p"
          );
          const answerElement = OuterGroupDiv[i + 1]?.querySelector(
            "div[data-message-author-role='assistant'] div.markdown.prose"
          );

          const question = questionElement ? questionElement.innerText.toString() : "";
          const answer = answerElement ? answerElement.innerHTML : "";

          if (question && answer) {
            resultChats.push({ question, answer });
          }
        }

        return resultChats;
      });
    }

    await browser.close();

    res.status(200).json({ title, Chats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(process.env.PORT || 3300, () => {
  console.log("Server started");
});

module.exports = app;
