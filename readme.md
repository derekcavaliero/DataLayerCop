# DataLayerCop.js

⚠️ _**This is a work in progress.** It has not been fully tested in a production environment yet. Use at your own risk._

## Purpose
Google Tag Managers `dataLayer` is a powerful tool for passing data between your website and your GTM container. The beautiful thing about the dataLayer is that it doesn't particularly care what format your data is in. It can be a simple object literal, an array of objects, or even a string. This flexibility is great, but sometimes - strict rules are needed to ensure that the dataLayer stays manageable over the course of time.

Most Google Tag Manager implementors know how to properly access and use GTM's preview tool to inspect and test that a dataLayer payload is in an expected format. Unfortunately, dataLayer events are often implemented by developers who are not familiar with (or don't have access to) GTM's preview tool. This can lead to dataLayer payloads being sent to GTM that are not in the expected format. This can cause GTM to fail silently and not fire tags as expected. DataLayerCop can help you catch these mistakes before they make they make their way into production.

## How it works
The DataLayerCop is an observer that "Monkey Patches" the `dataLayer.push()` method. This allows it to inspect every dataLayer payload that is sent to GTM. It then runs a series of rules (assertions) against the payload. If any of the rules fail, then DataLayerCop will report the failure.

_**NOTE:** To prevent DataLayerCop from interfering with GTM's internal dataLayer events such as `gtm.js`, `gtm.click` etc... any payloads with an `event` property value prefixed with `gtm.` are ignored._

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

### Execution Order
Rules are a simple array of objects. They are executed top-to-bottom in the order they are defined. This means that you can have rules that depend on other rules. For example, you may want to assert that the `event` property exists before asserting that the `event` property is in the preferred case.

_**NOTE:** Nested rules are not currently supported. This may be considered in future versions._

### Using predefined rules
The library comes with a few predefined rules that you can use out of the box. To use them, you can specify a `predefined` property on your rule object. The value of `predefined` should be a string that matches the key of the predefined rule you want to use. For example, to use the `eventExists` rule, you would do this:

The following predefined rules are available:

- `event_property_exists`
- `event_is_namespaced`
- `payload_properties_are_preferred_case`
- `event_is_preferred_case_after_namespace`

```javascript
{
  predefined: 'event_property_exists',
  dropOnFail: false,
  severity: 'critical'
}
```

### Rule Properties

#### name
This is a string that will be used to identify the rule in the console output. It is optional, but highly recommended.

#### type
Instructs the observer what type of payload this rule should apply to. The only two options supported are `gtm` and `gtag`. This is to support hybrid implementations where `gtag()` may share the same dataLayer global variable as a GTM Container. `gtag()` does not send object literals to the dataLayer they use a command pattern instead. This means that the payload is not a simple object literal, but rather an array of objects. DataLayerCop will automatically detect this and handle it accordingly.

_**NOTE:** It is highly recommended to not share the same dataLayer global variable between GTM and gtag() implementations. You should try to migrate all of your tagging logic to use GTM tags instead of direct integrations via `gtag()` if possible._

#### assert
This is a function that will be called with the dataLayer payload as the only argument. Every `assert()` must return a boolean value. If the assertion fails, then DataLayerCop will report the failure in the browser console via `console.warn()`.

#### dropOnFail
In some situations you may way to prevent a dataLayer payload from being processed if something is critically wrong with the payload itself. For example, if you have a rule that asserts that the `event` property exists, but it does not, then you may want to prevent the payload from being processed at all. This is where `dropOnFail` comes in. If set to `true`, then the payload will be dropped and not processed any further. If set to `false` (the default), then the payload will be processed as normal.

#### severity
This is a string that will be used to identify the severity in the event of a failure. Primary purpose of `severity` is for use with the `report` configuration option. By default, rules do not have a `severity` set. If you want to use the `report` configuration option, then you must set a `severity` for each rule. 

## Reporting

The default behavior of the DataLayerCop is to report failures to the browser console via `console.warn()`. This is useful for debugging purposes, but not very useful for production environments. To help with this, DataLayerCop provides a `report` configuration option that allows you to specify how you want to report failures. There are two built in reporting options: `toDataLayer` and `toUrl`.

### Reporting in Production

It is highly recommended to have different configurations for pre-production vs. production environments. For example, you may want to report less severe failures in pre-production environments, but only critical ones in production.

### Options

#### toUrl
This option will send a payload via `POST` to an endpoint of your choice using the `navigator.sendBeacon` browser API. This is useful for sending failures to a 1st party logging endpoint (such as a Cloudflare Worker that sends a message to a Slack channel). 

The payload will be a JSON string that looks like this:

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
To keep things simple, the format that is sent to the dataLayer is sent to work with GTM's native `JavaScript Error` trigger types. This will also prevent any possible infinite loop scenarios where a rule fails, and then the reporting of that failure causes another rule to fail, and so on. 

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

## Known Limitations and Caveats

### This is NOT a unit testing library
The library is ignorant to what actions should trigger what dataLayer payloads. You should use GTM's preview tool to test that your dataLayer events are firing as expected - and/or utilize a more comprehensive unit testing library such as Jest or Mocha built into a CI/CD pipeline.

This also means that it can only run tests on payloads that _do_ exist - it cannot assert if a payload _should_ exist.

### This is purposefully meant to be lightweight
