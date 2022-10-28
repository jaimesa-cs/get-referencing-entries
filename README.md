# Contentstack UI Extensions Template

This github repo contains a template that will get you started when building UI Extensions in Contentstack. It supports all 3 types of extensions, custom fields, sidebar widgets, and dashboard widgets.

The code consists of two parts, the extension folder, where the code of your extension will reside, and the uploader folder, which will be used to upload your extension to Contentstack.

The major benefit of this repo is that it allows you to implement UI Extensions for Contentstack using create-react-app (with typescript) and host it in Contentstack. The provided `upload.js` script takes care of the upload, update and cleaning of your extension as you update your code and re-upload it using
such script.

See below more details on what such script does:

## The magic: `upload.js`

The `upload.js` Javascript does the following tasks:

1. It depends on the build.log output from your `yarn|npm build` command. If you review the `package.json` file you will see that when running the build script, it outputs the result into a `build.log` file.

1. The script looks into that `build.log` file to determine where the react app main javascript and css files are, and what their filenames are.

```javascript
...

File sizes after gzip:

  391.27 kB (-2 B)  build/static/js/main.5819706c.js
  19.58 kB          build/static/css/main.82f603fc.css

The project was built assuming it is hosted at /.
You can control this with the homepage field in your package.json.

...
```

1. The script uses regular expressions to match both files, and later on will upload both to Contentstack and will retrieve the Contentstack asset urls for both, so then those can be replaced in the `index.html`, inside the `public` folder. This is the typical configuration of a react app created using `create-react-app`. It relies on three files:

   - `index.html`, available in the `public` folder. This file is used as a reference when building your application. The build process will create a new `index.html` file based on this, where both, the build-generated _main_ css and _main_ javascript files are referenced. This html file contains an html node where the application is mounted on, normally something like:

   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head>
       ...
     </head>
     <body>
       ...
       <div id="root"></div>
     </body>
   </html>
   ```

   - `main.XXXXXX.js`, your application bundle, i.e. all your code which has been minified during the build process.

   - `main.XXXXXX.css`, your application styles, i.e. all your css code which has been minified during the build process.

1. The script uploads first the _main_ javascript file and retrieves the asset url that Contentstack assigns to the asset after a successful upload.

1. Then it uploads the _main_ css file, and retrieves the asset url assigned to the asset by Contentstack.

1. At this point the script updates the `index.html` file inside the `build` folder and replaces the local references to the css and js main files with the asset urls from Contentstack.

1. Next, the script uploads the `index.html` to Contentstack with the updated refererences and retrieves the asset url for the `index.html` file itself, which later on will be used as the "_external_" url when configuring the extension.

1. By now, the script is ready to create the UI extension and does so using the provided configuration file. The `build.log` generation as well as the `upload.js` script execution is configured in the `package.json` file of your `extension` application:

```json
"scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build > build.log",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "cs:upload": "react-scripts build > build.log && cd ../uploader && node upload.js run -i input.json",
    "cs:reupload": "cd ../uploader && node upload.js run -i input.json"
  }

```

Check out the following scripts:

- `build`, builds the react app and writes the build output into `build.log`.
- `cs:upload`, runs the build and executes the `upload.js` using a configuration file, in the example provided that file is `input.json`. Check the **Extension Configuration Files** section for further details.
- `cs:reupload`, runs the `upload.js` script with `input.json` using the existing built artifacts, i.e. it doesn't trigger the build process itself.

## Extension Configuration Files

The script allows you to upload the extension as a **custom field**, a **sidebar widget** and/or a **dashboard widget**, depending on the configuration in the file used as input. The template provides with examples for all 3 types of extensions.

Those files are:

- `example.widget.input.json`
- `example.custom-field.input.json`
- `example.dashboard.input.json`

### Common configuration attributes

All extensions need these attributes for the upload script to upload the extension to Contentstack:

```json
{
  "extension": "field",
  "buildFolder": "/path/to/extension/build",
  "buildLog": "/path/to/extension/build.log",
  "replacement": "/static/.+/((.+).(css|js))$",
  "name": "Custom Field Example",
  "assetsFolder": "xxxxxxxxxxxxxxx",
  "verbose": false,
  "purge": true,
  "config": {
    "parameterA": "Value A",
    "parameterB": "Value B"
  }
}
```

Where:

- **extension**, is the extension type, either `field`, `widget` or `dashboard`.
- **buildFolder**, the full path to your build folder. Defaults to the `build` folder within the `extension` app folder.
- **buildLog**, full path to the `build.log` file generated by the `build` script.
- **replacement**, the regular expression to find files to replace in the build.log output. The first group on the expression will be used as the 'key' for a map containing all matches. The actual match is the full partial path to the file to be replaced.
- **name**, the extension name.
- **assetsFolder**, the folder in which the extension will be uploaded. The script creates a sub folder in that location using the name of the extension. In that subfolder, all three files (_index.html_, _main.xxx.js_ and _main.xxx.css_) are uploaded.
- **verbose**, whether the script should output verbose information.
- **purge**, whether the script should clean non-used files after a new upload. The build command generates new unique files when either css or js has been modified respectively, rendering the old ones basically obsolete. The script will update the `index.html` with the new references and will delete the old js and css files from Contentstack.
- **config**, a `JSON` object that will be used to configure the UI extension.

### Custom Field Configuration attributes

Additionally, when creating a **custom field** extension you need to provide these attributes too:

```JSON
// "extension": "field",
"type": "text" // The type fo custom field
```

### Sidebar Widget Configuration attributes

Additionally, when creating a **sidebar widget** extension you need to provide these attributes too:

```JSON
// "extension": "widget",
"scope": ["$all"] // A comma-separated of content types that will use the widget or $all for all content types
```

### Dashboard Widget Configuration attributes

Additionally, when creating a **dashboard widget** extension you need to provide these attributes too:

```JSON
// "extension": "dashboard",
"defaultWidth": "half" //The default width of the widget.
```

## Testing the extension and the script

In order to test the extension and the script you need to run either `yarn install` or `npm install` under both, the `extension` and the `uploader` folders. Additionally you will need to create a `.env` under the `uploader` folder with the following values:

```properties
CS_API_KEY=
CS_MANAGEMENT_TOKEN=
CS_CM_API_BASE_URL=https://api.contentstack.io
# ^^^ This API url is for NA's region

```

See the useful links below to learn how to create a management token and how extensions are configured.

### Useful links

- [Developers Reference Docs](https://www.contentstack.com/docs/developers)
- [Venus Component Library](https://www.contentstack.com/docs/developers/venus-component-library/)
- [UI Extensions SDK](https://github.com/contentstack/ui-extensions-sdk)
- [Generate A Management Token](https://www.contentstack.com/docs/developers/create-tokens/generate-a-management-token/)
- [Exensions API](https://github.com/contentstack/ui-extensions-sdk/blob/master/docs/ui-extensions-api-reference.md#inclusion-in-your-project)
- [Custom Fields](https://www.contentstack.com/docs/developers/create-custom-fields/)
- [Sidebar Widgets](https://www.contentstack.com/docs/developers/create-custom-widgets/)
- [Dashboard Widgets](https://www.contentstack.com/docs/developers/create-dashboard-widgets/)
