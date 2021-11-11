# 🪐 🛰️ Ground Control eoxharvester

Install all modules after cloning the repo: 
`npm install`

Start the dev server:
`npm run dev`

To check out a build:
`npm run build`

# CAUTION LIVE FIRING AREA

This page will make requests to the relevant google cloud function to process and save images.

This won't work as CORS will only allow requests made from the right domain.

To test locally, comment line 178 and uncomment line 179 in javascript/main.js.

This will instead query a dummy cloud function that allows requests from all origins but does not save any data.

