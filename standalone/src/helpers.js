import captureWebsite from 'capture-website';
import puppeteer from 'puppeteer';
import PQueue from "p-queue";
import {getConcurrency, getDefaultTimeoutSeconds, getSecret, getShowResults} from "./config.js";
import 'dotenv/config';

export const queue = new PQueue({concurrency: getConcurrency()});

const latest = {
    capture: undefined,
    url: undefined,
    date: undefined
};

export function showResults() {
    const showResults = getShowResults();
    return showResults && showResults === 'true';
}

export async function doCaptureWork(queryParameters) {
    latest.date = new Date();
    const options = getOptions(queryParameters);
    const url = options.url;
    latest.url = url;
    console.info('Capturing URL: ' + url + ' ...');
    if (true || options.plainPuppeteer === 'true') {
        return await tryWithPuppeteer(url, options);
    } else {
        try {
            const buffer = await captureWebsite.buffer(url, options);
            console.info(`Successfully captured URL: ${url}`);
            latest.capture = buffer;
            return {
                statusCode: 200,
                responseType: getResponseType(options),
                buffer: buffer
            }
        } catch (e) {
            console.error(e);
            console.info(`Capture website failed for URL: ${url}`);
            console.info('Retrying with plain Puppeteer...');
            return await tryWithPuppeteer(url, options);
        }
    }
}

export function allowedRequest(queryParameters) {
    const secret = getSecret();
    if (!secret) {
        return true;
    }
    if (!queryParameters || !queryParameters.secret) {
        return false;
    }
    return queryParameters.secret === secret;
}

export function getOptions(queryParameters) {
    const result = parseQueryParameters(queryParameters);
    result.launchOptions = {
       // headless: false,
	executablePath: '/usr/bin/google-chrome',
        args: [
		'--window-size=1500,1000',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--hide-scrollbars',
            '--mute-audio',
            '--use-fake-ui-for-media-stream' // Pages that ask for webcam/microphone access
        ]
    };
    if (!result.timeout) {
        result.timeout = getDefaultTimeoutSeconds();
    }
    fieldValuesToNumber(result, 'width', 'height', 'quality', 'scaleFactor', 'timeout', 'delay', 'offset');
    return result;
}

function parseQueryParameters(queryParameters) {
    return Object.keys(queryParameters).reduce((params, key) => {
        const q = queryParameters[key];
        let value;
        try {
            value = JSON.parse(q);
        } catch {
            value = q
        }
        return {
            ...params,
            [key]: value
        }
    }, queryParameters || {});
}

async function tryWithPuppeteer(url, options) {
    try {
        const buffer = await takePlainPuppeteerScreenshot(url, options);
        console.info(`Successfully captured URL: ${url}`);
        latest.capture = buffer;
        return {
            statusCode: 200,
            responseType: getResponseType(options),
            buffer: buffer
        }
    } catch (e) {
        console.log('Capture failed due to: ' + e.message);
        return {
            statusCode: 500,
            message: e.message
        }
    }
}
/*
async function takePlainPuppeteerScreenshot(url, options) {
    options.encoding = 'binary';
    options.wait_before_screenshot_ms = options.wait_before_screenshot_ms || 300;
    const browser = await puppeteer.launch(options.launchOptions);
    const page = await browser.newPage();
   // Set a realistic user-agent string
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36';
    await page.setUserAgent(userAgent);

    // Set the language to German
await page.setExtraHTTPHeaders({
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
});
await page.setViewport({ width: 1500, height: 1000 });
    await page.goto(url, {waitUntil: 'networkidle0'});
//	await acceptCookies(page);
  //  await setViewport(page, options);
await acceptCookies(page);
	await new Promise(r => setTimeout(r, 11000));
    await new Promise(r => setTimeout(r, options.wait_before_screenshot_ms));
await acceptCookies(page);
const customHeight = 1000; // Ihre gewünschte Höhe

await page.evaluate((height) => {
  document.body.style.height = `${height}px`;
  document.body.style.overflowY = 'hidden';
}, customHeight);
	await new Promise(r => setTimeout(r, 500));
await acceptCookies(page);
    const buffer = await page.screenshot({clip: {
    x: 0,
    y: 0,
    width: 1500,
    height: 1000
  },fullPage: false });
    await browser.close();
    return buffer;
}
*/

async function takePlainPuppeteerScreenshot(url, options) {
    options.encoding = 'binary';
    options.wait_before_screenshot_ms = options.wait_before_screenshot_ms || 300;

    const browser = await puppeteer.launch(options.launchOptions);
    const page = await browser.newPage();

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36';
    await page.setUserAgent(userAgent);

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
    });
    await page.setViewport({ width: 1500, height: 1000 });

    try {
        await page.goto(url, {waitUntil: 'networkidle0'});
    } catch (e) {
        console.error("Error during page navigation:", e);
    }

    try {
	await new Promise(r => setTimeout(r, 3000));
        await acceptCookies(page);
        await new Promise(r => setTimeout(r, 9000));
    } catch (e) {
        console.error("Error during cookie acceptance or wait:", e);
    }

    const customHeight = 1000;
/*
    try {
        await page.evaluate((height) => {
            document.body.style.height = `${height}px`;
            document.body.style.overflowY = 'hidden';
        }, customHeight);
    } catch (e) {
        console.error("Error during page evaluation:", e);
    }
*/
    let buffer = null;
    try {
        buffer = await page.screenshot({
            clip: {
                x: 0,
                y: 0,
                width: 1500,
                height: 1000
            },
            fullPage: false
        });
    } catch (e) {
        console.error("Error taking screenshot:", e);
    }

    await browser.close();
    return buffer;
}


async function acceptCookies(page) {
    await page.evaluate(`

if (typeof findAndClickTargetElements !== 'function') {

    function findAndClickTargetElements(root, exactMatches, partialMatches) {
        if (!root) return false;

        let clickedAnyElement = false; // Verfolgen, ob irgendein Element geklickt wurde

        // Umwandeln aller Texte in Kleinbuchstaben
        exactMatches = exactMatches.map(text => text.toLowerCase());
        partialMatches = partialMatches.map(text => text.toLowerCase());

        // Suchen in den normalen Elementen
        let targetElements = Array.from(root.querySelectorAll('a, button, input[type="button"], input[type="submit"], [onclick], [role="button"],.button'));
        for (let element of targetElements) {
            let elementText = (element.tagName.toLowerCase() === 'input') ? element.value : element.innerText;
            elementText = elementText ? elementText.trim().toLowerCase() : '';

            // Prüfen auf exakte oder teilweise Übereinstimmung
            if (elementText.length < 32 && (exactMatches.includes(elementText) || partialMatches.some(text => elementText.includes(text)))) {
	       const rect = element.getBoundingClientRect();
               const isVisible = rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
               if (isVisible) {
                  element.click();
                  clickedAnyElement = true;
               }
            }
        }

        // Suchen in Shadow DOMs
        let allElements = Array.from(root.querySelectorAll('*'));
        for (let element of allElements) {
            if (element.shadowRoot) {
                clickedAnyElement = findAndClickTargetElements(element.shadowRoot, exactMatches, partialMatches) || clickedAnyElement;
            }
        }

        return clickedAnyElement; // Gibt zurück, ob irgendein Element geklickt wurde
    }

}

try {
    // Starten der Suche im Haupt-DOM mit separaten Listen für exakte und teilweise Übereinstimmungen
    findAndClickTargetElements(document, ["Save","Speichern","Geht klar!","Das ist ok!", "Alles klar","OK","Verstanden","Got it!","Got it","OK, Understood!","OK, understood","Okay"], ["bestätigen", "accept","annehmen","einverständnis", "alles akzeptieren", "accept all", "annehmen", "akzeptieren", "einverstanden", "alle akzeptieren", "zustimmen", "accept", "allow all", "allow", "cookies akzeptieren","alle cookies","alle auswählen", "alle cookies akzeptieren", "ich akzeptiere", "alle zulassen", "agree to all", "erlauben", "speichern", "ablehnen", "stimme zu", "agree", "einwilligen","zulassen"]);
} catch (error) {
    document.body.innerHTML = '<p>Error: ' + error.message + '</p>';
}


    `);

}

async function setViewport(page, options) {
    if (options.width && options.height) {
        const viewportOptions = {
            width: options.width,
            height: options.height,
            deviceScaleFactor: options.scaleFactor ? options.scaleFactor : 1
        };
        await page.setViewport(viewportOptions);
    }
}

export function getResponseType(queryParams) {
    if (queryParams.type && queryParams.type === 'jpeg') {
        return 'jpg';
    }
    return 'png';
}

export function fieldValuesToNumber(obj, ...fields) {
    fields.forEach(f => {
        if (obj[f]) {
            const val = Number(obj[f]);
            obj[f] = Number.isNaN(val) ? obj[f] : val;
        }
    });
}

export function latestCapturePage(req, res) {
    let page = '';
    page += '<html lang="en">\n';
    page += '<body>\n';
    page += '<h1>Latest capture</h1>';
    if (latest.capture) {
        const latestEndpoint = '/latest';
        page += '<p>Date: ' + latest.date + '</p>\n';
        page += `<img src="${latestEndpoint}" width="800"  alt="Latest capture"/>\n`;
    } else {
        page += '<p>No capture found!</p>\n';
    }
    page += '</body>\n';
    page += '</html>\n';
    res.send(page);
}

export function latestCapture(req, res) {
    res.type('png');
    res.send(latest.capture);
}
