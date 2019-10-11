const nci = require("node-nfc-nci");
const https = require("https");
const rpio = require("rpio");

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

rpio.open(RELAY_CH1_PIN, rpio.OUTPUT, rpio.LOW);
rpio.open(RELAY_CH2_PIN, rpio.OUTPUT, rpio.LOW);
rpio.open(RELAY_CH3_PIN, rpio.OUTPUT, rpio.LOW);

const relay = {
  ch1: { write: (state) => rpio.write(RELAY_CH1_PIN, state) },
  ch2: { write: (state) => rpio.write(RELAY_CH2_PIN, state) },
  ch3: { write: (state) => rpio.write(RELAY_CH3_PIN, state) }
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

function signal(pin, on = true, timeout) {
  return new Promise(resolve => {
    pin.write(on ? rpio.HIGH : rpio.LOW);
  
    if (timeout) {
      setTimeout(() => { 
        pin.write(on ? rpio.LOW : rpio.HIGH);
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
