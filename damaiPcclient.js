let BaseSend = require("./baseSend");
const { curly } = require("node-libcurl");
class Client extends BaseSend {
  constructor(activityId, dataId, index) {
    super();
    this.index = index;
    this.platform = "damai";
    this.valueType = "text";
    this.activityId = activityId;
    this.dataId = dataId;
    this.isNeedProxy = true;
  }

  async init() {
    await new Promise((resolve) => {
      this.eventBus.once("connectedReady", resolve);
      this.tryConnect();
    });
    await this.initAgent();
  }

  async initAgent() {
    let url = `https://detail.damai.cn/subpage?itemId=${this.activityId}&dataType=2&apiVersion=2.0&dmChannel=pc@damai_pc&bizCode=ali.china.damai&scenario=itemsku&privilegeActId=&callback=`;
    //  url = `http://114.124.119.205:5000/ping`;

    if (this.dataId) {
      url += `&dataId=` + this.dataId;
    }

    let uniqueId = this.activityId + "_" + this.dataId + "_" + this.index;
    this.uniqueId = uniqueId;
    let options = {
      url,
      headers: {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "sec-ch-ua":
          '"Chromium";v="118", "Microsoft Edge";v="118", "Not=A?Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "script",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Geciko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.46",

        Referer: `https://detail.damai.cn/item.htm?&id=${this.activityId}`,
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: null,
      method: "GET",
    };
    const httpHeader = Object.entries(headers).map(
      ([key, value]) => `${key}: ${value}`,
    );
    options = {
      url,
      httpHeader,
      sslVerifyPeer: false, // 👈 关键：跳过证书验证
      sslVerifyHost: false, // 👈 同时跳过主机名验证
      timeout: 1, // 1秒超时
      connectTimeout: 800,
    };
    this.options = options;
    this.ip = await this.getAgent();
    this.isReady = true;
  }

  async send() {
    if (!this.isReady) {
      return "";
    }

    let res;
    try {
      let { statusCode, data } = await curly(options.url, {
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

    if (
      res.includes("window") ||
      res.includes("小二很忙") ||
      res.includes("upstream server") |
        res.includes("https://bixi.alicdn.com/punish")
    ) {
      console.log(res);
      return {
        errMsg: "请求频繁",
        res: [],
      };
    } else if (res.includes("skuList")) {
      res = res.slice(1, -1);
      let {
        itemBasicInfo: { itemTitle, sellingStartTime, t },

        perform: { skuList },
      } = JSON.parse(res);
      skuList.forEach((one) => {
        one.quantitySellAble = Number(one.salableQuantity);
      });
      // pc的signkey没有用的
      return {
        errMsg: "",
        res: skuList,
        signKey: t,
      };
    } else {
      console.log("未知错误", res);
      return {
        errMsg: "未知错误" + res,
        res: [],
      };
    }
  }
}

module.exports = Client;
