let Client = require("./damaiPcClient.js");
let { sleep } = require("./utils.js");
let { openPage, getTime } = require("../damai/utils.js");
let ip;
let one = async (index) => {
  let obj = new Client(773373145673, "", 1);
  await obj.init();
  ip = obj.ip;
  console.log(1111, ip);
  let start = Date.now();

  // setTimeout(() => {
  //   obj.close();
  // }, 1000);
  let sleepTime = 500;
  let isFre = false
  for (let i = 0; i < 1000; i++) {
    let res = await obj.send();
    if (res.errMsg.includes("频繁")) {
      isFre = true
      console.log('停留30')
      sleepTime = 15000;
    }
    await sleep(sleepTime);
    if(isFre){
      isFre = false
      sleepTime = 500;
    }
    console.log("nodejs", res);
  }
  // let use = Date.now() - start;
  // console.log(use / 100 - 1200);
};

// for (let i = 0; i <= 20; i++) {
one();
// setTimeout(async () => {
//   let { page } = await openPage(ip);

//   await page.evaluate(async () => {
//     let sleep = (time) => new Promise((r) => setTimeout(r, time));

//     for (let i = 0; i < 1000; i++) {
//       let url = `https://detail.damai.cn/subpage?itemId=${773373145673}&dataType=2&apiVersion=2.0&dmChannel=pc@damai_pc&bizCode=ali.china.damai&scenario=itemsku&privilegeActId=&callback=`;
//       // url = `http://14.124.119.205:5000/ping`;

//       let options = {
//         url,
//         headers: {
//           accept: "*/*",
//           "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
//           "sec-ch-ua":
//             '"Chromium";v="118", "Microsoft Edge";v="118", "Not=A?Brand";v="99"',
//           "sec-ch-ua-mobile": "?0",
//           "sec-ch-ua-platform": '"Windows"',
//           "sec-fetch-dest": "script",
//           "sec-fetch-mode": "no-cors",
//           "sec-fetch-site": "same-origin",
//           "User-Agent":
//             "Mozilla/5.0 (Linux; Android 8.0.0; SM-G955U Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36",

//           Referer: `https://detail.damai.cn/item.htm?&id=${773373145673}`,
//           "Referrer-Policy": "strict-origin-when-cross-origin",
//         },
//         body: null,
//         method: "GET",
//       };
//       try {
//         let res = await fetch(url,options);
//         await res.text();

//         console.log(res);
//       } catch (e) {
//         console.log(e);
//       }
//       await sleep(5000);
//     }
//   });
// }, 2000);
// // }
