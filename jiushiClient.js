let BaseSend = require("./baseSend");
let { fetch, ProxyAgent, request } = require("undici");
let { getSign, sleep, getTime } = require("../damai/utils");

class Client extends BaseSend {
  constructor({ showId, sessionId, seatPlanId, index }) {
    super();
    this.index = index;
    this.platform = "bili";
    this.valueType = "json";
    this.showId = showId;
    this.sessionId = sessionId;
    this.isNeedProxy = true;
    this.seatPlanId = seatPlanId;
    this.times = 0;
  }

  async getJiushiToken() {
    let token = await new Promise((resolve) => {
      this.eventBus.once("getJiushiTokenDone", ({ jiuShiToken }) =>
        resolve(jiuShiToken)
      );
      this.client.write(
        JSON.stringify({
          getJiushiToken: true,
        })
      );
    });
    this.token = token;
  }

  async getOptions() {
    await this.getJiushiToken();

    const url = `https://644898358795db000137473f.jussyun.com/cyy_gatewayapi/show/external/buyer/v5/show/${this.showId}/session/${this.sessionId}/seating/dynamic?lang=zh&terminalSrc=H5&ver=4.21.0`;

    const headers = {
      Host: "644898358795db000137473f.jussyun.com",
      Connection: "keep-alive",
      // "Content-Length": "1502",
      product: "pc",
      "access-token": this.token,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090c11)XWEB/14315",
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      "terminal-src": "H5",
      ver: "4.21.0",
      "channel-Id": "",
      Origin: "https://644898358795db000137473f.jussyun.com",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",

      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "zh-CN,zh;q=0.9",
    };

    const body = {
      // zoneConcreteIds: this.zoneIds, //后面参数会动态传递
      bizSeatPlanIds: this.seatPlanId,
      displaySeatPlanIds: this.seatPlanId,
      lang: "zh",
    };
    // let ua = randomUserAgent.getRandom()
    return {
      url,
      headers,
      body: JSON.stringify(body),
      method: "POST",
    };
  }
  async init() {
    await new Promise((resolve) => {
      this.eventBus.once("connectedReady", resolve);
      this.tryConnect();
    });
    await this.initAgent(true);
  }

  async initAgent() {
    let options = await this.getOptions();
    let uniqueId =
      this.show +
      "_" +
      this.sessionId +
      "_" +
      this.seatPlanId +
      "_" +
      this.index;
    this.uniqueId = uniqueId;

    this.options = options;
    if (this.isNeedProxy) {
      this.ip = await this.getAgent();
    }
    this.isReady = true;
  }

  async send(params) {
    this.times++;
    if (!this.isReady) {
      return "";
    }
    let res = await this.myProxy(params);

    if (!res) {
      return {
        errMsg: "超时",
        res: [],
      };
    }

    let { data, comments } = res;

    if (comments && comments.includes("invalid")) {
      // 应该不会出现,因为server会自动的更新
      console.log("过期后更新===============>", getTime());
      this.isReady = false;
      await this.initAgent(true);
      return this.send(params);
    } else if (comments && comments.includes("成功")) {
      let arr = data
        .map((one) => ({
          zoneConcreteId: one.zoneConcreteId,
          saleStatus: one.seatPlanSeatBits?.[0].bitstr,
        }))
        .filter((one) => one.saleStatus);

      return {
        res: arr,
        errMsg: "",
      };
    } else {
      return {
        errMsg: "未知错误" + comments,
        res: [],
      };
    }
  }
}

module.exports = Client;
