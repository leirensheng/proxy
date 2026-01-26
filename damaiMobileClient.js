let BaseSend = require("./baseSend");
let { fetch, ProxyAgent, request } = require("undici");
let { getSign, sleep, getTime } = require("../damai/utils");
const { curly } = require("node-libcurl");

class Client extends BaseSend {
  constructor(activityId, dataId, index, skuIdToTypeMap, port, isWx) {
    super();
    this.index = index;
    this.platform = "damai";
    this.valueType = "json";
    this.activityId = activityId;
    this.skuIdToTypeMap = skuIdToTypeMap;
    this.dataId = dataId;
    this.isNeedProxy = true;
    this.isWx = isWx;
    this.isXuni = [4822].includes(Number(port));
    this.times = 0;
  }

  async getMobileCookieAndToken(isRefresh) {
    let { cookie, token } = await new Promise((resolve) => {
      this.eventBus.once("getMobileCookieAndTokenDone", ({ token, cookie }) =>
        resolve({ token, cookie }),
      );
      this.client.write(
        JSON.stringify({
          isRefresh,
          activityId: this.activityId,
          getMobileCookieAndToken: true,
        }),
      );
    });

    this.cookie = cookie;
    this.token = token;
  }

  async getOptions(isRefresh) {
    await this.getMobileCookieAndToken(isRefresh);
    console.log("cookie更新完成");
    // damai_app
    let data = {
      itemId: this.activityId,
      platform: "282",
      comboChannel: "4",
      dmChannel: this.isWx ? "damai@weixin_gzh" : "damai@damaih5_h5",
    };
    let t = Date.now();
    let sign = getSign(data, t, this.token);
    // let ua = randomUserAgent.getRandom()
    let url = `https://mtop.damai.cn/h5/mtop.damai.item.detail.getdetail/1.0/?jsv=2.7.5&appKey=12574478&t=${t}&sign=${sign}&api=mtop.damai.item.detail.getdetail&v=1.0&H5Request=true&type=json&timeout=10000&dataType=json&valueType=string&forceAntiCreep=true&AntiCreep=true&data=${encodeURIComponent(
      JSON.stringify(data),
    )}`;
    let headers = {
      cookie: this.cookie,
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      "sec-ch-ua": `"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"`,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 15; MAG-AN00 Build/HONORMAG-AN00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.136 Mobile Safari/537.36 XWEB/1340099 MMWEBSDK/20250201 MMWEBID/929 MicroMessenger/8.0.58.2841(0x28003A3C) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64",
      // "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    };

    const httpHeader = Object.entries(headers).map(
      ([key, value]) => `${key}: ${value}`,
    );
    return {
      url,
      httpHeader,
      sslVerifyPeer: false, // 👈 关键：跳过证书验证
      sslVerifyHost: false, // 👈 同时跳过主机名验证
      timeout: 1, // 1秒超时
      connectTimeout: 800,
      // proxy: this.ip,
    };
  }
  async init() {
    await new Promise((resolve) => {
      this.eventBus.once("connectedReady", resolve);
      this.tryConnect();
    });
    await this.initAgent();
    // this.updateOptions();
  }
  // updateOptions() {
  //   setInterval(() => {
  //     this.initAgent(true);
  //   }, 15000 * (this.index + 1));
  // }

  async initAgent(isRefresh) {
    let options = await this.getOptions(isRefresh);
    // console.log("更新options完成");
    let uniqueId = this.activityId + "_" + this.dataId + "_" + this.index;
    this.uniqueId = uniqueId;

    this.options = options;
    if (this.isNeedProxy) {
      this.ip = await this.getAgent();
      console.log("ip更新完成");
    }
    this.isReady = true;
  }

  async send() {
    this.times++;
    if (!this.isReady) {
      return "";
    }
    let res;
    try {
      let { statusCode, data } = await curly(this.options.url, {
        ...this.options,
        proxy: this.ip,
      });
      res = data;
    } catch (e) {
      return {
        errMsg: "超时",
        res: [],
      };
    }

    let {
      data: { legacy, buyButton },
      ret,
    } = res;

    // console.log("11111,"+buyButton)
    // this.isReady = false;
    // await this.initAgent(true);

    if (ret && ret.length && ret.some((one) => one.match(/令牌过期/))) {
      console.log("过期后更新");
      this.isReady = false;
      await this.initAgent(true);
      return this.send();
    } else if (
      ret &&
      ret.length &&
      ret.some((one) =>
        one.match(/(挤爆)|(令牌过期)|(小二很忙)|(网络系统异常)|(令牌为空)/),
      )
    ) {
      console.log(ret);
      return {
        res: [],
        errMsg: "挤爆或过期或网络系统异常",
      };
    } else if (ret.length && !ret[0].includes("成功")) {
      return {
        resFromPage: [],
        errFromPage: "12未知错误" + JSON.stringify(ret),
      };
    } else {
      let isSellout;
      if (buyButton) {
        isSellout = !buyButton.text.includes("立即");
      } else {
        let {
          detailViewComponentMap: {
            item: {
              item: { buyBtnText, performBases, isSoldOutAndNoUnpaid },
            },
          },
        } = JSON.parse(legacy);

        // if (typeof isSoldOutAndNoUnpaid !== "undefined") {
        //   isSellout = isSoldOutAndNoUnpaid;
        // } else {
        // }
        // console.log(buyBtnText)
        isSellout = !buyBtnText.includes("立即");
      }

      // console.log(1111,buyBtnText)
      let arr;

      arr = Object.keys(this.skuIdToTypeMap).map((id) => ({
        type: this.skuIdToTypeMap[id],
        skuStatus: "1",
        skuId: id,
        quantitySellAble: this.isXuni ? 9 : isSellout ? 0 : 9,
        // quantitySellAble: 9,
      }));

      return {
        res: arr,
        errMsg: "",
      };
    }

    // else if (res.includes("skuList")) {
    //   res = res.slice(1, -1);

    //   let {
    //     perform: { skuList },
    //   } = JSON.parse(res);
    //   skuList.forEach((one) => {
    //     one.quantitySellAble = Number(one.salableQuantity);
    //   });

    //   return {
    //     errMsg: "",
    //     res: skuList,
    //   };
    // } else {
    //   console.log("未知错误", res);
    //   return {
    //     errMsg: "未知错误" + res,
    //     res: [],
    //   };
    // }
  }
}

// let init = async () => {
//   let obj = new Client(794294808101);
//   console.log("in前");

//   await obj.init();
//   console.log("准备send");

//   let res = await obj.send();
//   console.log("完成");

//   console.log(res);
// };

// init();
// obj.getOptions();
// obj.test();
module.exports = Client;
