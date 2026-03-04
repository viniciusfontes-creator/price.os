import { getIntegratedDataFromBigQuery } from './lib/bigquery-service';

async function main() {
  try {
    const data = await getIntegratedDataFromBigQuery();
    console.log("Success. Rows:", data.length);
  } catch(e) {
    console.error("Failed:", e);
  }
}
main();
