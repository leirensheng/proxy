let BaseSend = require("./baseSend");
let { sleep, sendAppMsg } = require("../maoyan/utils");
let { fetch, ProxyAgent, request, errors } = require("undici");

class Client extends BaseSend {
  constructor(activityId, dataId, index) {
    super();
    this.index = index;
    this.platform = "xiecheng";
    this.valueType = "json";
    this.activityId = activityId;
    this.dataId = dataId;
    this.isNeedProxy = false;
  }

  async init() {
    if (this.isNeedProxy) {
      await new Promise((resolve) => {
        this.eventBus.once("connectedReady", resolve);
        this.tryConnect();
      });
    }
    await this.initAgent();
  }

  async initAgent() {
    let url =
      "https://m.ctrip.com/restapi/soa2/15241/json/queryRankThemeAndProductInfo";

    let uniqueId = this.activityId + "_" + this.dataId + "_" + this.index;
    this.uniqueId = uniqueId;

    let body = {
      themeIdList: [567],
      needProductInfo: true,
      channelCode: "Channel_StreamModule1",
      extras: {
        needActorInfo: "false",
        poiId: String(this.activityId),
        dateKey: this.dataId,
      },
      destinationInfo: { categoryId: 4, globalId: null },
    };
    let options = {
      url,
      headers: {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/json",
        cookieorigin: "https://m.ctrip.com",
        priority: "u=1, i",
        "sec-ch-ua": '""',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '""',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",

        Referer:
          "https://m.ctrip.com/webapp/you/xgspoi/activityPoi/158/146187535.html",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: JSON.stringify(body),
      method: "POST",
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
        }).then((res) => res.json());
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
    try {
      let {
        rankThemeInfoList: [{ rankProductInfoList }],
      } = res;

      if (!rankProductInfoList) {
        return {
          res: [],
          errMsg: "",
        };
      }
      let info = rankProductInfoList
        .map((one) => ({
          saleStatus: one.productInfo.saleStatus,
          seatPlanId: one.productId,
          canBuyCount: 9,
        }))
        .filter((one) => one.saleStatus === 1);
      // console.log(info);
      return {
        res: info,
        errMsg: "",
      };
    } catch (e) {
      sendAppMsg("info", "携程检测出错,返回" + JSON.stringify(res));
      return {
        res: [],
        errMsg: "",
      };
    }
  }
}

module.exports = Client;
