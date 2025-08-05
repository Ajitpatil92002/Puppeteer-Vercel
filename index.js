const express = require('express');
const app = express();

// Detect if running on Vercel/AWS Lambda (serverless) or locally
const isServerless =
    !!process.env.AWS_LAMBDA_FUNCTION_VERSION || !!process.env.VERCEL;

const puppeteer = isServerless
    ? require('puppeteer-core')
    : require('puppeteer');
const chrome = isServerless ? require('chrome-aws-lambda') : null;

app.get('/api', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    let browser;
    try {
        let options;
        if (isServerless) {
            options = {
                args: [
                    ...chrome.args,
                    '--hide-scrollbars',
                    '--disable-web-security',
                ],
                defaultViewport: chrome.defaultViewport,
                executablePath: await chrome.executablePath,
                headless: true,
                ignoreHTTPSErrors: true,
            };
        } else {
            options = {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            };
        }

        browser = await puppeteer.launch(options);
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        );
        await page.setJavaScriptEnabled(true);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const title = await page.evaluate(() => document.title);

        if (title === '404: This page could not be found') {
            await browser.close();
            return res.status(404).json({ error: 'Not Found' });
        }

        // Extract articles under the parent with class containing '@thread-xl/thread:pt-header-height'
        const articles = await page.evaluate(() => {
            const parent = document.querySelector(
                '[class*="@thread-xl/thread:pt-header-height"]'
            );
            if (!parent) return [];
            return Array.from(parent.querySelectorAll(':scope > article')).map(
                article => ({
                    turn: article.getAttribute('data-turn'),
                    text: article.textContent,
                    html: article.innerHTML,
                })
            );
        });

        // Build Chats array: pair user (question, text) and next assistant (answer, html)
        const Chats = [];
        for (let i = 0; i < articles.length - 1; i++) {
            if (
                articles[i].turn === 'user' &&
                articles[i + 1].turn === 'assistant'
            ) {
                Chats.push({
                    question: articles[i].text,
                    answer: articles[i + 1].html,
                });
            }
        }

        await browser.close();

        res.status(200).json({ title, Chats });
    } catch (err) {
        console.error('Error details:', err);
        if (browser) await browser.close();
        res.status(500).json({ error: err.message || 'Something went wrong' });
    }
});

app.listen(process.env.PORT || 3300, () => {
    console.log('Server started');
});

module.exports = app;
