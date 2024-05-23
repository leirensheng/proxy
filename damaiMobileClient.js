let BaseSend = require("./baseSend");
let { fetch, ProxyAgent, request } = require("undici");
let { getSign, sleep } = require("../damai/utils");

class Client extends BaseSend {
  constructor(activityId, dataId, index, skuIdToTypeMap, isSpecial) {
    super();
    this.index = index;
    this.platform = "damai";
    this.valueType = "json";
    this.activityId = activityId;
    this.skuIdToTypeMap = skuIdToTypeMap;
    this.dataId = dataId;
    this.isSpecial = isSpecial;
    this.isNeedProxy = false;
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

    let data = {
      itemId: this.activityId,
      platform: "8",
      comboChannel: "2",
      dmChannel: "damai@damaih5_h5",
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
  }

  async initAgent(isRefresh) {
    let options = await this.getOptions(isRefresh);
    let uniqueId = this.activityId + "_" + this.dataId + "_" + this.index;
    this.uniqueId = uniqueId;

    this.options = options;
    if (this.isNeedProxy) {
      this.ip = await this.getAgent();
    }
    console.log(this.ip);
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

    let {
      data: { legacy },
      ret,
    } = res;
    if (ret && ret.length && ret.some((one) => one.match(/令牌过期/))) {
      console.log("过期后更新");
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
            item: { buyBtnText, performBases },
          },
        },
      } = JSON.parse(legacy);

      let isSellout = !buyBtnText.includes("立即");

      let arr;
      if (this.isSpecial) {
        arr = Object.keys(this.skuIdToTypeMap).map((id) => ({
          type: this.skuIdToTypeMap[id],
          skuStatus: "1",
          skuId: id,
          quantitySellAble: isSellout ? 0 : 9,
        }));
      } else {
        arr = performBases
          .map((one) => {
            // todo: 多日期不是perform[0]
            if (one.performs[0].skuList) {
              return one.performs[0].skuList;
            } else {
              // console.log("心方式", skuIdToTypeMap);
              let arr = Object.keys(this.skuIdToTypeMap).map((id) => {
                let type = this.skuIdToTypeMap[id];
                let [perform, price] = type.split("_");
                return {
                  type,
                  id,
                  perform,
                  price,
                };
              });

              arr = arr.filter(
                (item) => item.perform === one.performs[0].performName
              );

              return arr.map((item) => ({
                ...item,
                skuStatus: "1",
                skuId: item.id,
                skuName: item.price,
                quantitySellAble: isSellout ? 0 : 9,
              }));
            }
          })
          .flat()
          .filter(Boolean);

        if (!arr.length) {
          return {
            res: [],
            errMsg: "没有skuList",
          };
        }
        arr.forEach((one) => {
          if (one.skuStatus !== "1") {
            one.quantitySellAble = 0;
          }
        });

        // console.log(1111,arr)
      }
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
