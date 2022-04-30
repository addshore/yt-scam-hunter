const ytsr = require('ytsr');
var columnify = require('columnify')

async function start() {
    const filters1 = await ytsr.getFilters('"eth" OR "btc"');
    const filter1 = filters1.get('Type').get('Video');
    const filters2 = await ytsr.getFilters(filter1.url);
    const filter2 = filters2.get('Features').get('Live');
    const ytOptions = {
        pages: 10,
      }

    // create an array to store the results
    const results = [];
    const requests = 1;
    var result = await ytsr(filter2.url, ytOptions);
    results.push(...result.items);
    while (result.continuation !== null) {
        requests++;
        result = await ytsr.continueReq(result.continuation);
        results.push(...result.items);
    }

    // Output result count
    console.log("Got " + results.length + " videos from search in " + requests + " request(s)");

    // And table
    var columns = columnify(results, options)
    console.log(columns)
}

start();