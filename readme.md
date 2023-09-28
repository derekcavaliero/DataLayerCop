# DataLayerCop.js

_⚠️ *This is a work in progress.* It has not been fully tested in a production environment yet. Use at your own risk._

## Purpose
Google Tag Managers `dataLayer` is a powerful tool for passing data between your website and your GTM container. The beautiful thing about the dataLayer is that it doesn't particularly care what format your data is in. It can be a simple object literal, an array of objects, or even a string. This flexibility is great, but sometimes - strict rules are needed to ensure that the dataLayer stays manageable over the course of time.

Most Google Tag Manager implementors know how to properly access and use GTM's preview tool to inspect and test that a dataLayer payload is in an expected format. Unfortunately, dataLayer events are often implemented by developers who are not familiar with (or don't have access to) GTM's preview tool. This can lead to dataLayer payloads being sent to GTM that are not in the expected format. This can cause GTM to fail silently and not fire tags as expected. DataLayerCop can help you catch these mistakes before they make they make their way into production.

## How it works
The DataLayerCop is an observer that "Monkey Patches" the `dataLayer.push()` method. This allows it to inspect every dataLayer payload that is sent to GTM. It then runs a series of rules (assertions) against the payload. If any of the rules fail, then DataLayerCop will report the failure.

_*NOTE:* To prevent DataLayerCop from interfering with GTM's internal dataLayer events such as `gtm.js`, `gtm.click` etc... any payloads with an `event` property value prefixed with `gtm.` are ignored._

## Configuration

DataLayerCop sets some default configuration values for you, but you can override them by passing in a configuration object. 

```javascript
const dataLayerCop = new DataLayerCop({
  dataLayer: 'dataLayer',
  preferredCase: 'snake',
  report: {
    only: [],
    toDataLayer: false,
    toUrl: false,
  },
  rules: [
    // one or more rule objects
  ]
});
```

## Rules

The backbone of how DataLayerCop works is via rules. Rules are simple objects that define an assertion to be made against the dataLayer payload. If the assertion fails (returns `false`), then DataLayerCop will report the failure in the browser console via `console.warn()` - and other optional reporting destinations (see more in the "Reporting").

For example, a simple rule that asserts that an `event` property exists in the dataLayer payload could look like this:

```javascript
{
  name: 'Expects `event` property to exist',
  type: 'gtm',
  assert: (payload) => payload.hasOwnProperty('event'),
  dropOnFail: false,
  severity: 'critical'
}
```

### Rule Properties

#### name
This is a string that will be used to identify the rule in the console output. It is optional, but highly recommended.

#### type
Instructs the observer what type of payload this rule should apply to. The only two options supported are `gtm` and `gtag`. This is to support hybrid implementations where `gtag()` may share the same dataLayer global variable as a GTM Container. `gtag()` does not send object literals to the dataLayer they use a command pattern instead. This means that the payload is not a simple object literal, but rather an array of objects. DataLayerCop will automatically detect this and handle it accordingly.

_*NOTE:* It is highly recommended to not share the same dataLayer global variable between GTM and gtag() implementations. You should try to migrate all of your tagging logic to use GTM tags instead of direct integrations via `gtag()` if possible._

#### assert
This is a function that will be called with the dataLayer payload as the only argument. Every `assert()` must return a boolean value. If the assertion fails, then DataLayerCop will report the failure in the browser console via `console.warn()`.

#### dropOnFail
In some situations you may way to prevent a dataLayer payload from being processed if something is critically wrong with the payload itself. For example, if you have a rule that asserts that the `event` property exists, but it does not, then you may want to prevent the payload from being processed at all. This is where `dropOnFail` comes in. If set to `true`, then the payload will be dropped and not processed any further. If set to `false` (the default), then the payload will be processed as normal.

#### severity
This is a string that will be used to identify the severity in the event of a failure. Primary purpose of `severity` is for use with the `report` configuration option. By default, rules do not have a `severity` set. If you want to use the `report` configuration option, then you must set a `severity` for each rule. 

## Reporting

The default behavior of the DataLayerCop is to report failures to the browser console via `console.warn()`. This is useful for debugging purposes, but not very useful for production environments. To help with this, DataLayerCop provides a `report` configuration option that allows you to specify how you want to report failures. There are two built in reporting options: `toDataLayer` and `toUrl`.

### Options

#### toUrl
This option will send a payload via `POST` to an endpoint of your choice using the `navigator.sendBeacon` browser API. This is useful for sending failures to a 1st party logging endpoint. The payload will be a JSON string that looks like this:

```json
{
  "hostname": "www.example.com",
  "url": "https://www.example.com/",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko)",
  "rule": {
    "severity": "critical",
    "name": "Expects `event` property to exist",
    "type": "gtm",
    "dropOnFail": false,
  },
  "payload": {
    "page": "/",
    "title": "Home"
  }
}
```

#### toDataLayer

```javascript
{
  'event': 'gtm.pageError',
  'gtm.errorMessage': 'Expects `event` property to exist',
  'datalayercop': {
    "hostname": "www.example.com",
    "url": "https://www.example.com/",
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko)",
    "rule": {
      "severity": "critical",
      "name": "Expects `event` property to exist",
      "type": "gtm",
      "dropOnFail": false,
    },
    "payload": "{\"page\":\"/",\"title\":\"Home\"}"
  }
}
```