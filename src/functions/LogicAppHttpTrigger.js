const { app } = require('@azure/functions');
const { DefaultAzureCredential } = require("@azure/identity");
const { AppConfigurationClient } = require("@azure/app-configuration");

app.http('LogicAppHttpTrigger', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        // Azure Functionsの環境変数からendpointを取得
        const endpoint = process.env["AZURE_APPCONFIG_ENDPOINT"];
        if (!endpoint) {
            context.log("AZURE_APPCONFIG_ENDPOINT is not set in the environment variables.");
            return { status: 500, body: "Internal server error" };
        }

        // Azure FunctionsのManaged Identityから認証情報を取得
        const credential = new DefaultAzureCredential();
        const client = new AppConfigurationClient(endpoint, credential);

        // Webhookのリクエストパラメータからkeyとlabelを取得
        let body = {};
        if (request.method === "POST") {
            body = await request.json();
        }
        const key = request.query.get('key') || (body && body.key);
        const label = request.query.get('label') || (body && body.label);

        if (!key) {
            return { status: 400, body: "Please provide a key parameter." };
        }

        const appConfigSetting = await client.getConfigurationSetting({ key, label });

        return { body: appConfigSetting.value };
    }
});
