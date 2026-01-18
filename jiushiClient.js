let BaseSend = require("./baseSend");
let { fetch } = require("undici");
let { sleep, getTime } = require("../damai/utils");

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
