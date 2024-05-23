let BaseSend = require("./baseSend");
let { sleep } = require("../maoyan/utils");
let { fetch, ProxyAgent, request } = require("undici");

class Client extends BaseSend {
  constructor(activityId, dataId, index, dateName) {
    super();
    this.index = index;
    this.platform = "maoyan";
    this.valueType = "text";
    this.activityId = activityId;
    this.dataId = dataId;
    this.dateName = dateName;
    this.isNeedProxy = false;
  }

  async init() {
    if(this.isNeedProxy){

      await new Promise((resolve) => {
        this.eventBus.once("connectedReady", resolve);
        this.tryConnect();
      });
    }
    await this.initAgent();
  }

  async initAgent() {
    let url = `https://show.maoyan.com/maoyansh/myshow/ajax/v2/show/${this.dataId}/tickets?performanceId=${this.activityId}`;
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

        Referer: "https://show.maoyan.com/qqw",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: null,
      method: "GET",
    };
    this.options = options;
    if (this.isNeedProxy) {
      this.ip = await this.getAgent();
    }
    this.isReady = true;
  }

  async send() {
    if (!this.isReady) {
      return "";
    }
    let res;
    if (this.isNeedProxy) {
      res = await this.myProxy();
    } else {
      try {
        let p1 = fetch(this.options.url, {
          ...this.options,
          keepalive: true,
        }).then((res) => res.text());
        let p2 = sleep(2000);
        res = await Promise.race([p1, p2]);
      } catch (e) {
        console.log(e);
      }
    }
    if (!res) {
      return {
        errMsg: "超时",
        res: [],
      };
    }
    if (
      !res ||
      res.includes("Forbidden") ||
      res.includes("window") ||
      res.includes(`"code":500`) ||
      res.includes("upstream server") |
        res.includes("https://bixi.alicdn.com/punish")
    ) {
      console.log("res", res);
      return {
        err: "请求频繁" + res,
        res: [],
      };
    } else if (res.includes("remainingStock")) {
      let { data } = JSON.parse(res);
      let skuList = data.map(
        ({ sellPrice, remainingStock, ticketClassId }) => ({
          ticketType: this.dateName + "_" + sellPrice,
          skuId: ticketClassId,
          quantitySellAble: Number(remainingStock),
        })
      );
      // console.log(skuList);

      return {
        err: "",
        res: skuList,
      };
    } else {
      console.log('未知')
      return {
        err: "未知错误" + res,
        res: [],
      };
    }
  }
}

module.exports = Client;
