const SHOULD_MEMORY_LEAK = false;
// const fetch =  require('node-fetch')
const puppeteer = require("puppeteer");
const { sleep, openPage2, getValidIp, Client } = require("./utils");
let { fetch, ProxyAgent, setGlobalDispatcher, request } = require("undici");

let ip;
let proxyAgent;
let length = 10;
let init = async () => {
  ip = await getValidIp();
  // let { page, browser } = await openPage2(ip);
  let peakUsage = 0;
  let start = Date.now();

  // let ip = '121.204.16.244:6891'

  console.time();

  proxyAgent = new ProxyAgent({
    uri: "http://" + ip,
    bodyTimeout: 500,
    proxyTls: {
      timeout: 200,
    },
  });
  // setGlobalDispatcher(proxyAgent);
  console.timeEnd();

  for (let i = 0; i < length; i++) {
    console.log("request", i);
    try {
      let { statusCode, body } = await request(
        "http://14.120.182.175:7000/ping",
        { dispatcher: proxyAgent }
      );

      let res = await body.json();
      // console.log(res)
    } catch (e) {
      console.log(e);
      console.log("nodejs推出了", Date.now());
      break;
    }

    await sleep(20);
  }
  console.log("request时间", (Date.now() - start) / 1000);
  // await sleep(100000)
};
let init2 = async () => {
  // let { page, browser } = await openPage2(ip);
  let peakUsage = 0;
  let start = Date.now();

  // let ip = '121.204.16.244:6891'

  for (let i = 0; i < length; i++) {
    console.log("fetch", i);
    try {
      let res = await fetch("http://14.120.182.175:7000/ping", {
        dispatcher: proxyAgent,
      });

      res = await res.json();
      // console.log(res)
    } catch (e) {
      console.log(e);
      console.log("fetch", Date.now());
      break;
    }

    await sleep(20);
  }
  console.log("fetch时间", (Date.now() - start) / 1000);
  // await sleep(100000)
};
// setTimeout(() => {
init();

setTimeout(() => {
  init2();
}, 300);
// init();
// init();

// }, 1000);
