// Run this file to read values from Node environment variables
// Helpful if you don't want to commit API keys into repositories for auto deploys (e.g. Netlify)
// Ignore this file if you are setting values in CloudIntegrationConfig.js directly

const fs = require('fs');
const path = require('path');

const content = `var CLOUD_INTEGRATION_CONFIG = {
    credentials:{
        google: {
            GOOGLE_CLIENT_ID: '${process.env.GOOGLE_CLIENT_ID}',
            GOOGLE_API_KEY: '${process.env.GOOGLE_API_KEY}'
        }
    },
    settings: {
        DISABLE_SNAP_CLOUD: ${process.env.DISABLE_SNAP_CLOUD}
    }

}
`;


fs.writeFileSync(path.join(__dirname, 'CloudIntegrationConfig.js'), content);

console.log('src/CloudIntegrationConfig.js created');
