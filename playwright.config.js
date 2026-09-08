const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./browser-tests',use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:4173',headless:true},webServer:process.env.TEST_BASE_URL?undefined:{command:'node browser-tests/server.cjs',url:'http://127.0.0.1:4173'},reporter:'list'});
