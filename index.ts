import {CONFIG} from './config';
import {Rainbow} from './rainbow';
import {puppeteerService} from './puppeteer/puppeteer';

import * as Feed from 'rss-to-json';
import * as RssParser from 'rss-parser';
import * as pug from 'pug';
import * as fs from 'fs';

const PUG_MAIN_FILE = './main.pug';
const rssParser = new RssParser({customFields: {item: ['book_description','book_small_image_url','pubDate','book_medium_image_url']}});

async function getCodeCraftrArticles() {
    const url = `https://www.codecraftr.nl/feed.xml`;
    return Feed.load(url).then(data => ({
        articles: data.items.slice(0, CONFIG.codeCraftrArticles.numberOfArticles || 5)
    }));
}

async function getCurrentlyReading() {
    const url = CONFIG.goodreads.url + CONFIG.goodreads.key + `&shelf=currently-reading`;
    return rssParser.parseURL(url).then(data => ({
        currentlyReading: data.items
    }))
}

async function getReadBooks() {
    const url = CONFIG.goodreads.url + CONFIG.goodreads.key + `&shelf=read&shelf=work`;
    return rssParser.parseURL(url).then(data => ({
        readBooks: data.items.sort((a,b)=>b.isoDate.localeCompare(a.isoDate))
    }))
}

async function generateBadges() {
    const colors = new Rainbow();
    colors.setNumberRange(1, CONFIG.badges.list.length);
    colors.setSpectrum(...CONFIG.badges.spectrum);
    const formattedBadges = CONFIG.badges.list.map((badge, index) => ({
        name: badge.name,
        logo: badge.name.toLocaleLowerCase(),
        color: colors.colourAt(index)
    }));
    return Promise.resolve({badges: formattedBadges});
}

async function getRefreshDate() {
    const refreshDate = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZoneName: 'short',
        timeZone: 'Europe/Stockholm'
    });
    return Promise.resolve({refreshDate});
}

async function getGithubData() {
    const data = CONFIG.github;
    const enabled =
        data.stats.mostUsedLanguages ||
        data.stats.overallStats ||
        data.highlightedRepos.length > 0;

    const github = {
        ...data,
        enabled
    };

    return Promise.resolve({github});
}

async function getSocialData() {
    const social = CONFIG.social.map(item => ({
        ...item,
        logo: item.logo || item.name
    }));
    return Promise.resolve({social});
}


async function generateReadMe(input) {
    const compiledHtml = pug.compileFile(PUG_MAIN_FILE, {pretty: true})(input);
    fs.writeFileSync('README.md', compiledHtml);
}

async function perform() {
    let promises = [];

    if (CONFIG.badges && CONFIG.badges.enabled) {
        promises.push(generateBadges());
    }

    if (CONFIG.codeCraftrArticles && CONFIG.codeCraftrArticles.enabled) {
        promises.push(getCodeCraftrArticles());
    }

    if(CONFIG.goodreads && CONFIG.goodreads.enabled) {
        promises.push(getCurrentlyReading());
        promises.push(getReadBooks());
    }
    promises.push(getRefreshDate());
    promises.push(getGithubData());
    promises.push(getSocialData());

    const input = await Promise.all(promises).then(data =>
        data.reduce((acc, val) => ({...acc, ...val}))
    );

    if (puppeteerService.browser) {
        puppeteerService.close();
    }

    console.log(`✅ README.md has been succesfully built!`);

    generateReadMe(input);
}

perform();
