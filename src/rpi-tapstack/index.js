const nci = require("node-nfc-nci");
const https = require("https");
const Gpio = require("onoff").Gpio;

const NOMOS_BASE_URI = process.env.NOMOS_BASE_URI || "https://membership.vanhack.ca/services/web";
const NOMOS_API_KEY = process.env.NOMOS_API_KEY || "";

if (!NOMOS_API_KEY || NOMOS_API_KEY === "") {
  throw new Error("NOMOS_API_KEY required");
  return process.exit(1);
}

const NOMOS_PRIVILEGE_CODES = process.env.NOMOS_PRIVILEGE_CODES || "";
const requiredPrivileges = NOMOS_PRIVILEGE_CODES.split(",").map(code => code.trim()).filter(code => code !== "");

if (requiredPrivileges.length <= 0) {
  throw new Error("NOMOS_PRIVILEGE_CODES require at least one privilege code");
  return process.exit(1);
}

const RELAY_CH1_PIN = process.env.RELAY_CH1_PIN || 37;
const RELAY_CH2_PIN = process.env.RELAY_CH2_PIN || 38;
const RELAY_CH3_PIN = process.env.RELAY_CH3_PIN || 40;

if (!Gpio.accessible) {
  throw new Error("GPIO is not accessible");
  return process.exit(1);
}

const relay = {
  ch1: new Gpio(RELAY_CH1_PIN, "low", { activeLow: true }),
  ch2: new Gpio(RELAY_CH2_PIN, "low", { activeLow: true }),
  ch3: new Gpio(RELAY_CH3_PIN, "low", { activeLow: true })
};

function checkRfid(id) {
  return new Promise((resolve, reject) => {
    const url = `${NOMOS_BASE_URI}/AuthService1.svc/CheckRfid?rfid=${id}`;
    const opts = {
      headers: { "X-Api-Key": NOMOS_API_KEY }
    };
    
    https
      .get(url, opts, (resp) => {
        let data = "";
        
        resp.on("data", chunk => {
          data += chunk;
        });
        
        resp.on("end", () => {
          if (resp.statusCode === 200) {
            const json = JSON.parse(data);
            return resolve(json);
          }
          
          reject({ statusCode: resp.statusCode, data: data });
        });
      })
      .on("error", e => {
        reject(e);
      });
  });
}

function hasPrivileges(privileges = [], codes = []) {
  return codes.every(code => authorization.privileges.some(priv => priv.code === code));
}

function signal(gpio, on = true, timeout) {
  return new Promise(resolve => {
    gpio.writeSync(on ? 1 : 0);
  
    if (timeout) {
      setTimeout(() => { 
        gpio.writeSync(on ? 0 : 1);
        resolve();
      }, timeout);
    } else {
      resolve();
    }
  });
}

nci.listen(context => {
  context.on("error", msg => console.error(msg));
  
  context.on("arrived", async tag => {
    console.log(`tag arrived: ${JSON.stringify(tag)}`);
    
    signal(relay.ch2, true, 200);
    
    let authorization;
    
    try {
      authorization = await checkRfid(tag.uid.id);
    } catch (e) {
      console.error(e);
      return;
    }
    
    console.log(`tag authorization: ${JSON.stringify(authorization)}`);
    
    const hasAccess = hasPrivileges(authorization.privileges, requiredPrivileges);
    
    console.log(`tag hasAccess: ${hasAccess}`);
    
    if (hasAccess) {
      signal(relay.ch1, true, 3000);
      signal(relay.ch2, true, 200);
    } else {
      await activate(relay.ch2, true, 100);
      await activate(relay.ch2, false, 10);
      await activate(relay.ch2, true, 100);
    }
  });
});
