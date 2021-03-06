const nci = require("node-nfc-nci");
const https = require('https');

const NOMOS_BASE_URI = process.env.NOMOS_BASE_URI || "https://membership.vanhack.ca/services/web";
const NOMOS_API_KEY = process.env.NOMOS_API_KEY || "";

nci.listen(context => {
  context.on("error", msg => console.error(msg));
  
  context.on("arrived", tag => {
    https.get(`${NOMOS_BASE_URI}/AuthService1.svc/CheckRfid?rfid=${tag.uid.id}`, {
      headers: { "X-Api-Key": NOMOS_API_KEY }
    }, (resp) => {
      let data = "";
      
      resp.on("data", chunk => {
        data += chunk;
      });
      
      resp.on("end", () => {
        console.log(JSON.parse(data));
      });
    }).on("error", err => console.error(err.message));
  });
});
