let BaseSend = require("./baseSend");
let { fetch, ProxyAgent, request } = require("undici");
let { getSign, sleep, getTime } = require("../damai/utils");

function getUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    return (c === "x" ? (Math.random() * 16) | 0 : "r&0x3" | "0x8").toString(
      16
    );
  });
}

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
    // await this.getJiushiToken();

    const url = `https://644898358795db000137473f.jussyun.com/cyy_gatewayapi/show/external/buyer/v5/show/${this.showId}/session/${this.sessionId}/seating/dynamic?lang=zh&terminalSrc=H5&ver=4.21.0`;

    const headers = {
      Host: "644898358795db000137473f.jussyun.com",
      Connection: "keep-alive",
      // "Content-Length": "1502",
      product: "pc",
      // "access-token": this.token,
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
    await this.initAgent();
  }

  async initAgent() {
    // this.options = await this.getOptions();
    // let uniqueId =
    //   this.show +
    //   "_" +
    //   this.sessionId +
    //   "_" +
    //   this.seatPlanId +
    //   "_" +
    //   this.index;
    this.uniqueId = getUUID();

    // this.options = options;
    if (this.isNeedProxy) {
      let { agent, ip } = await this.getAgent();
      this.agent = agent;
      this.ip = ip;
    }
    this.isReady = true;
  }

  async send(options) {
    if (!this.isReady) {
      return "";
    }

    let res;
    try {
      // console.log("fetch",agent.ip,uniqueId)
      let p1 = fetch(options.url, {
        ...options,
        keepalive: true,
        dispatcher: this.agent,
      }).then((res) => res.json());
      let p2 = sleep(1000);
      res = await Promise.race([p1, p2]);
      if (!res) {
        throw new Error("timeout");
      }
    } catch (e) {
      if (
        !e.message.match(
          /fetch\sfailed|timeout| "<!DOCTYPE "... is not valid JSON/
        )
      ) {
        console.log("出错信息", e, options.url);
      }
      // console.log("超时了");
      // if (!e.message.includes("timeout")) {
      // this.removeProxyIp({ uniqueId });
      // }
      // if (!res || e.message.includes("fetch failed")) {
      // }
    }
    // let res = await this.myProxy(params, headers);

    if (!res) {
      return {
        errMsg: "超时",
        res: [],
      };
    }

    let { data, comments } = res;

    if (comments && comments.includes("invalid")) {
      // 应该不会出现,因为server会自动的更新
      console.log(
        options.url,
        "不应该出现的, token过期后更新===============>",
        getTime()
      );

      await sleep(100000);
      // this.isReady = false;
      // await this.initAgent(true);
      // return this.send(params, headers);
    } else if (comments && comments.includes("成功")) {
      let isApp = options.url.includes("644898358795db000137473f");
      let arr = [];
      if (isApp) {
        arr = data
          .map((one) => ({
            zoneConcreteId: one.zoneConcreteId,
            saleStatus: one.seatPlanSeatBits?.[0].bitstr,
          }))
          .filter((one) => one.saleStatus);
      } else {
        arr = data.filter((one) => one.saleStatus);
      }

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
