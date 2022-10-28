#!/usr/bin/env node

import "dotenv/config";

import * as fs from "fs";

import FormData from "form-data";
import axios from "axios";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function LOG(options, message) {
  if (options.verbose) {
    console.log(`[${options.name}] :: ${message}`);
  }
}

async function run(options) {
  //1. Update index.html with the newly generated references
  const extensionsFolderUid = await replaceReferences(options);
  //2. Upload index.html with new paths
  const { url: indexUrl } = await uploadAsset(extensionsFolderUid, options.indexHtmlPath);
  //3. Create the extension

  try {
    const { notice } = await createExtension(options, indexUrl);
    LOG(options, `${notice}`);
  } catch (error) {
    console.log(`${error}`);
  }
  //4. Purge old files
  if (options.purge) {
    await purge(extensionsFolderUid, options);
    LOG(options, `Purge completed!`);
  }
  console.log("Script completed!");
}

async function purge(folderUid, options) {
  const defaultOptions = getDefaultAxiosOptions({ method: "GET" });
  const response = await axios(
    `${process.env.CS_CM_API_BASE_URL}/v3/assets?include_folders=true&folder=${folderUid}`,
    defaultOptions
  );
  const validFiles = Object.keys(options.references);

  if (response && response.data && response.data.assets && response.data.assets.length > 0) {
    LOG(options, `Purging extension folder...`);
    const assetsToPurge = response.data.assets.filter((f) => f.title !== "index.html" && !validFiles.includes(f.title));
    if (options.verbose) {
      LOG(options, `Assets to purge: ${JSON.stringify(assetsToPurge.length)}`);
      for (let i = 0; i < assetsToPurge.length; i++) {
        LOG(options, `- ${assetsToPurge[i].title}, ${assetsToPurge[i].uid}`);
      }
    }

    if (assetsToPurge && assetsToPurge.length > 0) {
      const assetUids = assetsToPurge.map((a) => a.uid);
      const deleteOptions = getDefaultAxiosOptions({ method: "DELETE" });
      for (let i = 0; i < assetUids.length; i++) {
        LOG(options, `Purging asset: ${assetUids[i]}...`);
        try {
          const result = await axios(`${process.env.CS_CM_API_BASE_URL}/v3/assets/${assetUids[i]}`, deleteOptions);
          const { notice } = result;
          LOG(options, `${notice}`);
        } catch (error) {
          console.log(`${error}`);
        }
      }
    } else {
      LOG(options, `Nothing to purge. Done!`);
    }
  } else {
    LOG(options, `Nothing to purge. Done!`);
  }
}

function getDefaultAxiosOptions(options) {
  return {
    ...options,
    headers: {
      ...options.headers,
      authorization: process.env.CS_MANAGEMENT_TOKEN,
      api_key: process.env.CS_API_KEY,
    },
  };
}

async function getAssetUid(folderUid, assetName) {
  const options = getDefaultAxiosOptions({ method: "GET" });
  const response = await axios(`${process.env.CS_CM_API_BASE_URL}/v3/assets?folder=${folderUid}`, options);
  if (response && response.data && response.data.assets && response.data.assets.length > 0) {
    const a = response.data.assets.filter((f) => f.title === assetName);
    if (a && a.length > 0) {
      return Promise.resolve(a[0].uid);
    }
  }
  return Promise.resolve("");
}

async function createExtension(options, url) {
  const getOptions = getDefaultAxiosOptions({ method: "GET" });
  const foundResponse = await axios(
    `${process.env.CS_CM_API_BASE_URL}/v3/extensions?query="type":"${options.extension}"&only[BASE][]=title`,
    getOptions
  );
  let extensionUid = "";

  if (
    foundResponse &&
    foundResponse.data &&
    foundResponse.data.extensions &&
    foundResponse.data.extensions.length > 0
  ) {
    const e = foundResponse.data.extensions.filter((f) => f.title === options.name);
    if (e && e.length > 0) {
      extensionUid = e[0].uid;
    }
  }
  const method = extensionUid === "" ? "POST" : "PUT";
  const api =
    extensionUid === ""
      ? `${process.env.CS_CM_API_BASE_URL}/v3/extensions`
      : `${process.env.CS_CM_API_BASE_URL}/v3/extensions/${extensionUid}`;

  let extension = {
    tags: ["custom-field", "react", options.name],
    title: options.name,
    src: url,
    multiple: false,
    config: options.config,
    type: options.extension,
  };

  switch (options.extension) {
    case "field":
      extension.data_type = options.type;
      break;
    case "widget":
      extension.data_type = options.type;
      extension.scope = {
        content_types: options.scope,
      };
      break;
    case "dashboard":
      extension.default_width = options.defaultWidth;
      break;
    default:
      break;
  }

  const data = {
    extension: extension,
  };
  const defaultOptions = getDefaultAxiosOptions({ method: method, data: data });
  try {
    const response = await axios(`${api}`, defaultOptions);
    if (response && response.data) {
      return Promise.resolve(response.data);
    }
  } catch (error) {
    // console.log(error);
    return Promise.resolve({ error_code: error.response.status, error_message: error.response.statusText });
  }
  return Promise.resolve({ error_code: -2, error_message: "Something went wrong" });
}

function extractFilename(path) {
  const pathArray = path.split("/");
  const lastIndex = pathArray.length - 1;
  return pathArray[lastIndex];
}

async function getExtensionFolder(options, create = true) {
  const defaultOptions = getDefaultAxiosOptions({ method: "GET" });
  const response = await axios(
    `${process.env.CS_CM_API_BASE_URL}/v3/assets?include_folders=true&query={"is_dir": true}&folder=${options.assetsFolder}`,
    defaultOptions
  );

  let folderUid = "";
  if (response && response.data && response.data.assets && response.data.assets.length > 0) {
    const a = response.data.assets.filter((f) => f.name === options.name);
    if (a && a.length > 0) {
      folderUid = a[0].uid;
    }
  }
  if (folderUid !== "") {
    // LOG(options,"Folder found for extension: ", options.name, folderUid);
    return folderUid;
  } else {
    // LOG(options,"Creating folder for extension: ", options.name);
    if (create) {
      const createFolderOptions = getDefaultAxiosOptions({
        method: "POST",
        data: {
          asset: {
            name: options.name,
            parent_uid: options.assetsFolder,
          },
        },
      });
      const createFolderResponse = await axios(
        `${process.env.CS_CM_API_BASE_URL}/v3/assets/folders`,
        createFolderOptions
      );
      // LOG(createFolderResponse.data);
      return createFolderResponse.data.asset.uid;
    } else {
      return "";
    }
  }
}

async function uploadAsset(folderUid, filePath) {
  let url = `${process.env.CS_CM_API_BASE_URL}/v3/assets`;
  let method = "POST";
  var data = new FormData();
  const assetUid = await getAssetUid(folderUid, extractFilename(filePath));

  if (assetUid !== "") {
    method = "PUT";
    url = `${url}/${assetUid}`;
  } else {
    data.append("asset[parent_uid]", folderUid);
  }

  data.append("asset[upload]", fs.createReadStream(filePath));

  const axiosOptions = getDefaultAxiosOptions({ method: method, headers: { ...data.getHeaders() }, data: data });
  try {
    let response = await axios(url, axiosOptions);
    return response.data.asset;
  } catch (e) {
    console.log(e);
    return { error_code: -1, error_message: "Something went wrong" };
  }
}

//Assumes there's a group in position 1, that will be used as the key in the map
function getMap(pattern, text) {
  const regex = new RegExp(pattern, "gmi");
  const matches = [...text.matchAll(regex)];
  let map = {};
  matches.map((m) => {
    map[m[1]] = m[0];
    return m;
  });
  return map;
}

async function replaceReferences(options) {
  //1. Load index.html
  let result = fs.readFileSync(options.indexHtmlPath, { encoding: "utf8" });

  //2. Create extensions asset sub-folder, then upload css and js files to Contentstack and get their urls
  const extensionsFolderUid = await getExtensionFolder(options);
  LOG(options, `Extensions Folder: ${extensionsFolderUid}`);

  //3. Replace references in index.html
  for (const k in options.references) {
    const reference = options.references[k];
    LOG(options, `Replacing Reference: ${reference}`);
    const { url } = await uploadAsset(extensionsFolderUid, `${options.buildFolder}${reference}`);
    result = result.replace(reference, url);
  }
  fs.writeFileSync(options.indexHtmlPath, result);
  return extensionsFolderUid;
}

function inferFilesFromBuildLog(options) {
  LOG(options, `Inferring files from build log: ${options.buildLog}`);
  const text = fs.readFileSync(options.buildLog, { encoding: "utf8" });
  const o = {
    ...options,
    references: { ...getMap(options.replacement, text) },
  };
  LOG(options, `Inferred files: `);
  LOG(options, `References: ${JSON.stringify(o.references)}`);
  return o;
}

// eslint-disable-next-line no-unused-expressions
yargs(hideBin(process.argv))
  .command({
    command: "run",
    describe: "Uploads the custom field to contentstack",
    handler: (argv) => {
      // console.log("ARGS", argv);
      let options = JSON.parse(fs.readFileSync(argv.input, { encoding: "utf8" }));
      if (options.ref) {
        options = JSON.parse(fs.readFileSync(`${options.ref}`, { encoding: "utf8" }));
      }
      options = inferFilesFromBuildLog(options);
      options.indexHtmlPath = options.buildFolder + "/index.html";
      // LOG(options, `Running <${argv.$0}> with options: `);
      LOG(options, `${JSON.stringify(options, null, 2)}`);
      run(options);
    },
  })
  .option("input", {
    alias: "i",
    describe: "path to input file with all options.",
    type: "string",
    demandOption: true,
  })
  .option("verbose", {
    alias: "v",
    describe: "Verbose mode",
    type: "boolean",
    demandOption: false,
    default: false,
  })

  .example(
    `$0 deploy.js run -i "/Users/jaimesantosalcon/dev/cs/extensions/custom-fields/custom-list/contentstack/input.json" -v`,
    "Creates a custom field extension uploading all 3 files to contentstack and referencing those in the extension. Verbose mode."
  )
  //node unpublish.js run -d "2022-02-16 15:32:07" -e production -l en-us -f article,home -m dry-run  --v
  .help().argv;
