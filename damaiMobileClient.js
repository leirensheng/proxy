let BaseSend = require("./baseSend");
let { fetch, ProxyAgent, request } = require("undici");
let { getSign, sleep } = require("../damai/utils");
// const randomUserAgent = require("random-useragent");

class Client extends BaseSend {
  constructor(activityId, dataId, index, skuIdToTypeMap, port, isWx) {
    super();
    this.index = index;
    this.platform = "damai";
    this.valueType = "json";
    this.activityId = activityId;
    this.skuIdToTypeMap = skuIdToTypeMap;
    this.dataId = dataId;
    this.isNeedProxy = false;
    this.isWx = isWx;
    this.isXuni = [4822].includes(Number(port));
    this.times = 0;
  }

  async getMobileCookieAndToken(isRefresh) {
    let { cookie, token } = await new Promise((resolve) => {
      this.eventBus.once("getMobileCookieAndTokenDone", ({ token, cookie }) =>
        resolve({ token, cookie })
      );
      this.client.write(
        JSON.stringify({
          isRefresh,
          activityId: this.activityId,
          getMobileCookieAndToken: true,
        })
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
      platform: "8",
      comboChannel: "2",
      dmChannel: this.isWx ? "damai@weixin_gzh" : "damai@damaih5_h5",
    };
    let t = Date.now();
    let sign = getSign(data, t, this.token);
    return {
      url: `https://mtop.damai.cn/h5/mtop.damai.item.detail.getdetail/1.0/?jsv=2.7.2&appKey=12574478&t=${t}&sign=${sign}&api=mtop.damai.item.detail.getdetail&v=1.0&H5Request=true&type=json&timeout=10000&dataType=json&valueType=string&forceAntiCreep=true&AntiCreep=true&useH5=true&data=${encodeURIComponent(
        JSON.stringify(data)
      )}`,
      headers: {
        cookie: this.cookie,
        accept: "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        priority: "u=1, i",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        // "user-agent": this.isWx
        //   ? "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6305002e)"
        //   : randomUserAgent.getRandom(),
      },
      referrer: "https://m.damai.cn/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "include",
    };
  }
  async init() {
    await new Promise((resolve) => {
      this.eventBus.once("connectedReady", resolve);
      this.tryConnect();
    });
    await this.initAgent();
    this.updateOptions();
  }
  updateOptions() {
    setInterval(() => {
      this.initAgent(true);
    }, 60000 * (this.index + 1));
  }

  async initAgent(isRefresh) {
    let options = await this.getOptions(isRefresh);
    console.log("更新options完成");
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

    let {
      data: { legacy },
      ret,
    } = res;
    if (ret && ret.length && ret.some((one) => one.match(/令牌过期/))) {
      console.log("过期后更新");
      this.isReady = false;
      await this.initAgent(true);
      return this.send();
    } else if (
      ret &&
      ret.length &&
      ret.some((one) =>
        one.match(/(挤爆)|(令牌过期)|(小二很忙)|(网络系统异常)|(令牌为空)/)
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
      let {
        detailViewComponentMap: {
          item: {
            item: { buyBtnText, performBases, isSoldOutAndNoUnpaid },
          },
        },
      } = JSON.parse(legacy);

      let isSellout;
      if (typeof isSoldOutAndNoUnpaid !== "undefined") {
        isSellout = isSoldOutAndNoUnpaid;
      } else {
        isSellout = !buyBtnText.includes("立即");
      }

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
