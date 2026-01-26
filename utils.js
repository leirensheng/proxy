let sleep = (time) => new Promise((r) => setTimeout(r, time));
let isDistinct = 1;
let axios = require("axios");
let PubSub = require("./pubBus");
let eventBus = new PubSub();
let usedIp = 0;

let isGettingIp = false;

let getValidIp = async (ips, platform) => {
  if (isGettingIp) {
    await waitUntilOk();
  }
  isGettingIp = true;
  let getIp = async () => {
    let { data } = await axios(
      `http://mticket.ddns.net:4000/getValidIp?platform=` + platform,
      {
        timeout: 60000,
      },
    );
    let ip = data.data;
    if (ips.has(ip)) {
      throw new Error("重复");
    }
    return ip;
  };

  let realIp;
  try {
    let newFn = waitUntilSuccess(getIp, 590, usedIp > 80000 ? 1000 : 200);
    realIp = await newFn();
  } catch (e) {
    console.log("59次都提取失败了");
  }
  isGettingIp = false;
  eventBus.emit("isGettingDone");
  return realIp;
};

let formatNumber = (val) => (val < 10 ? "0" + val : val);
let getTime = (date) => {
  if (!date) {
    date = new Date();
  }
  let hour = date.getHours();
  let minute = date.getMinutes();
  let second = date.getSeconds();
  let millisecond = date.getMilliseconds();

  return `${formatNumber(hour)}:${formatNumber(minute)}:${formatNumber(
    second,
  )}.${millisecond}`;
};

let waitUntilSuccess = (fn, times0 = 20, sleepTime = 5000) => {
  return async function (...args) {
    let times = times0;
    while (times) {
      try {
        let res = await fn.call(this, ...args);
        times = 0;
        return res;
      } catch (e) {
        if (sleepTime) {
          await sleep(sleepTime);
        }
        times--;
        // console.log(e);
        console.log("出错重试=>" + e.message);
      }
    }
    throw new Error("出错了");
  };
};

let waitUntilOk = async () => {
  if (isGettingIp) {
    await new Promise((r) => {
      eventBus.once("isGettingDone", r);
    });
    await sleep(0);
    if (isGettingIp) {
      return waitUntilOk();
    }
  }
};

let getDouyaIp = async (ips) => {
  if (isGettingIp) {
    await waitUntilOk();
  }
  isGettingIp = true;
  let getIp = async () => {
    let { data } = await axios(
      `https://api.douyadaili.com/proxy/?service=GetUnl&authkey=P61D1Myddt0vsMgYhVgN&num=${1}&format=json&distinct=${isDistinct}&detail=1&portlen=4`,
    );
    if (data.msg.match(/今日最大|资源不足/)) {
      isDistinct = 0;
    }
    if (!data.data.length) {
      console.log(data);
      throw new Error("找不到ip");
    }
    // console.log(data)
    let ip = data.data[0].ip + ":" + data.data[0].port;
    // console.log("platform", platform);
    if (ips.has(ip)) {
      throw new Error("重复");
    }
    console.log("提取到的ip" + getTime(), ip);
    usedIp++;
    return ip;
  };
  let realIp;
  try {
    let newFn = waitUntilSuccess(getIp, 590, usedIp > 80000 ? 1000 : 200);
    realIp = await newFn();
  } catch (e) {
    console.log("59次都提取失败了");
  }
  isGettingIp = false;
  eventBus.emit("isGettingDone");
  return realIp;
};

module.exports = {
  sleep,
  getTime,
  waitUntilSuccess,
  getDouyaIp,
  getValidIp,
};
