let BaseSend = require("./baseSend");
let { fetch } = require("undici");
let { sleep, getTime } = require("../damai/utils");
const { curly } = require("node-libcurl");

function getUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    return (c === "x" ? (Math.random() * 16) | 0 : "r&0x3" | "0x8").toString(
      16,
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
    this.send = this.sendByCurl;
  }

  async init() {
    await new Promise((resolve) => {
      this.eventBus.once("connectedReady", resolve);
      this.tryConnect();
    });
    await this.initAgent();
  }

  async initAgent() {
    this.uniqueId = getUUID();
    if (this.isNeedProxy) {
      let { agent, ip } = await this.getAgent();
      this.agent = agent;
      this.ip = ip;
    }
    this.isReady = true;
  }
  async sendByCurl(options) {
    if (!this.isReady) {
      return "";
    }
    const url = options.url;
    const headers = options.headers || {};

    // 构造 httpHeader 数组（curly 要求）
    const httpHeader = Object.entries(headers).map(
      ([key, value]) => `${key}: ${value}`,
    );

    let resData = null;

    try {
      // 设置请求配置
      const curlOptions = {
        httpHeader,
        sslVerifyPeer: false, // 👈 关键：跳过证书验证
        sslVerifyHost: false, // 👈 同时跳过主机名验证
        timeout: 1, // 1秒超时
        connectTimeout: 800,
        proxy: this.ip,
        post: true,
        postFields: options.body,
      };

      const res = await curly(url, curlOptions);
      let { statusCode, data } = res;
      if (statusCode === 200) {
        resData = data;
      } else {
        throw new Error(`请求失败，状态码: ${statusCode}`);
      }
    } catch (e) {
      // 捕获 curly 抛出的错误（如网络错误、超时等）
      if (
        !e.message.match(
          /fetch\sfailed|403|timeout|CURLE_OPERATION_TIMEDOUT| "<!DOCTYPE "... is not valid JSON|Unexpected/,
        )
      ) {
        console.log("出错信息" + getTime(), e, url);
      }
      resData = null;
    }

    // 超时或无响应
    if (!resData) {
      return {
        errMsg: "超时",
        res: [],
      };
    }

    const { data, comments } = resData;

    // 处理 token invalid
    if (comments && comments.includes("invalid")) {
      console.log(
        url,
        "不应该出现的, token过期后更新===============>",
        getTime(),
      );
      await sleep(100000);
      // this.isReady = false;
      // await this.initAgent(true);
      // return this.sendByCurl(options);
    }

    // 成功逻辑
    if (comments && comments.includes("成功")) {
      const isApp = url.includes("644898358795db000137473f");
      let arr = [];

      if (isApp) {
        arr = (data || [])
          .map((one) => ({
            zoneConcreteId: one.zoneConcreteId,
            saleStatus: one.seatPlanSeatBits?.[0]?.bitstr,
          }))
          .filter((one) => one.saleStatus != null);
      } else {
        arr = (data || []).filter((one) => one.saleStatus != null);
      }

      return {
        res: arr,
        errMsg: "",
      };
    } else {
      return {
        errMsg: "未知错误" + (comments || ""),
        res: [],
      };
    }
  }
  async sendByUndici(options) {
    if (!this.isReady) {
      return "";
    }

    let res;
    try {
      console.log(options);
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
          /fetch\sfailed|timeout| "<!DOCTYPE "... is not valid JSON|Unexpected/,
        )
      ) {
        console.log("出错信息", e, options.url);
      }
    }

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
        getTime(),
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
