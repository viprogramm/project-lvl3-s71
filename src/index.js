import url from 'url';
import path from 'path';
import fs from 'mz/fs';

import getHttpClient from './lib/httpClient';
import { getLocalAssets, replaceAssetsPath } from './lib/domNode';

const generateNameByPath = (pageUrl) => {
  const { host, path: urlPath } = url.parse(pageUrl);
  const urlPathName = path.join(host, urlPath);
  return urlPathName.replace(/[^a-zA-Z]/g, '-');
};

const generateNewName = (name) => {
  if (name[0] === '/') {
    return name.slice(1).replace(/\//g, '-');
  }
  return name.replace(/\//g, '-');
};

const getSite = (pageUrl) => {
  const { protocol, host } = url.parse(pageUrl);
  return `${protocol}//${host}`;
};

const createAssetsFolder = folder =>
  fs.exists(folder)
    .then((isExist) => {
      if (!isExist) {
        return fs.mkdir(folder);
      }
      return isExist;
    });


const createAssetsMap = (html, pageUrl, saveFolder) => {
  const siteUrl = getSite(pageUrl);
  const assets = getLocalAssets(html);
  return assets.reduce((acc, file) => ({
    ...acc,
    [file]: {
      urlPath: url.resolve(siteUrl, file),
      savePath: path.resolve(saveFolder, generateNewName(file)),
    },
  }), {});
};

const downloadAssets = (httpClient, assetsMap) =>
  Promise.all(Object.keys(assetsMap).map((file) => {
    const { urlPath, savePath } = assetsMap[file];
    return httpClient({
      method: 'get',
      url: urlPath,
      responseType: 'stream',
    })
      .then(response =>
        response.data.pipe(fs.createWriteStream(savePath)),
      );
  }));

export default (pageUrl, outputFolder = './', httpClient = getHttpClient()) => {
  const htmlFileName = `${generateNameByPath(pageUrl)}.html`;
  const assetsFolderName = `${generateNameByPath(pageUrl)}_files`;
  const htmlFilePath = path.resolve(outputFolder, htmlFileName);
  const assetsFolderPath = path.resolve(outputFolder, assetsFolderName);

  return httpClient.get(pageUrl)
    .then(response =>
      createAssetsFolder(assetsFolderPath)
        .then(() => response.data),
    )
    .then((data) => {
      const assetsMap = createAssetsMap(data, pageUrl, assetsFolderPath);
      return downloadAssets(httpClient, assetsMap)
        .then(() => replaceAssetsPath(data, assetsMap));
    })
    .then(data =>
      fs.writeFile(htmlFilePath, data, 'utf8'),
    )
    .then(() =>
      htmlFilePath,
    );
};
