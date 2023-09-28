/**!
 * DataLayerCop.js
 * 
 * A utility library to help enforce dataLayer conventions and syntax.
 * Because sometimes... you just need to be the bad 👮.
 *
 * Author: Derek Cavaliero (@derekcavaliero)
 * Repository: https://github.com/derekcavaliero/datalayercop
 * Version: 1.0.beta
 * License: MIT
 */

"use strict";

class DataLayerCop 
{

  constructor(config = {}) {

    const defaults = {
      dataLayer: 'dataLayer', 
      preferredCase: 'snake', // One of 'snake', 'camel', or 'pascal'.
      report: {
        toUrl: false,
        toDataLayer: false,
      },        
      rules: [],
    };

    this.config = {};

    Object.assign(this.config, defaults, config);
      
    this.setDataLayer();

    this.registerRules();

    if (!Array.isArray(this.config.rules) || !this.config.rules?.length) {
      this.console('warn', 'No rules defined.');
      return;
    }

    this.modifyPushMethod();

    this.getDataLayer().push({
      event: 'datalayercop.loaded',
      rules: this.config.rules
    });

  }

  setDataLayer() {
    window[this.config.dataLayer] = window[this.config.dataLayer] || [];
  }

  getDataLayer() {
    return window[this.config.dataLayer];
  }

  getPredefinedRule(key) {

    const rules = {

      event_property_exists: {
        name: 'Expect payload to include an `event` property.',
        assert: (payload) => payload.hasOwnProperty('event') && payload.event.length,
        dropOnFail: false,
        type: 'gtm',
      },

      event_is_namespaced: {
        name: 'Expect `event` property value to be prefixed with a namespace.',
        assert: (payload) => this.callStatic('isNamespaced', payload.event),
        dropOnFail: false,
        type: 'gtm',
      },

      payload_properties_are_preferred_case: {
        name: `Expect all payload properties to match preferred case (${this.config.preferredCase}).`,
        assert: (payload) => {
          
          const properties = Object.keys(payload);

          for (let i = 0; i < properties.length; i++) {
            if (!this.isPreferredCase(properties[i]))
              return false;
          }

          return true;

        },
        dropOnFail: false
      },

      event_is_preferred_case_after_namespace: {
        name: `Expect \`event\` property value to match preferred case (${this.config.preferredCase}) after namespace.`,
        assert: (payload) => {

          if (!this.callStatic('isNamespaced', payload.event))
            return true;

          const event = payload.event.split('.')[1];
          return this.isPreferredCase(event);

        },
        dropOnFail: false,
        type: 'gtm',
      },

    };

    return rules[key] || {};

  }

  registerRules() {

    this.config.rules = this.config.rules.map((rule) => {

      if (rule.predefined) {
        rule = Object.assign({}, this.getPredefinedRule(rule.predefined), rule);
        delete rule.predefined;
      }

      return rule;

    });

  }

  processRules(payload, payloadType) {

    for (let i = 0; i < this.config.rules.length; i++) {

      let rule = this.config.rules[i];

      if (rule?.type && rule.type !== payloadType)
        continue;

      let test = this.enforce(rule, payload, payloadType);

      if (test.passed)
        continue;

      if (this.config.report.only.includes(rule?.severity)) {
        this.reportToUrl(test);
        this.reportToDataLayer(test);
      }
      
      if (rule.dropOnFail)
        return false;
      
    }
    
    return payload;

  }

  reportToDataLayer(test) {

    if (this.config.report.toDataLayer === false)
      return;

    test.payload = JSON.stringify(test.payload);

    this.getDataLayer().push({
      'event': 'gtm.pageError',
      'gtm.errorMessage': test.rule?.name,
      'datalayercop': test,
    });

  }

  reportToUrl(test) {

    if (!this.isValidUrl(this.config.report.toUrl)) {
      this.console('warn', `Attempted to report to URL - but an invalid URL was provided (${this.config.report.toUrl}).`);
      return;
    }

    let payload = {
      hostname: location.hostname,
      url: location.href,
      user_agent: navigator.userAgent,
    };

    Object.assign(payload, test);

    navigator.sendBeacon(this.config.report.toUrl, JSON.stringify(payload));

  }

  modifyPushMethod() {

    var _this = this;
    var originalPush = this.getDataLayer().push;
    
    this.getDataLayer().push = function() {

      let payload;

      if (_this.isArgumentsObject(arguments[0])) {
          
        /**
         * If arguments[0] is an arguments object, it is more than likely a gtag command.
         * one of: 'config', 'event', 'set', 'js', 'get', 'consent'
         * https://developers.google.com/gtagjs/reference/api
         */

        let command = arguments[0];
        
        if (command[0] == 'event')
          payload = _this.processRules(command, 'gtag');

      } else if (_this.callStatic('isObjectLiteral', arguments[0])) {

        /**
         * If argument[0] is an object literal - its likely a Google Tag Manager dataLayer payload. 
         */
        
        payload = arguments[0];

        // All dataLayer events namespaced with 'gtm.' are reserved for GTM internal use and should bypass any rules.
        if (!payload?.event?.startsWith('gtm.'))
          payload = _this.processRules(payload, 'gtm');

      }

      // if (payload && typeof payload !== 'array')
      //   payload = [payload];
  
      if (payload)
        return originalPush(payload);

    };

  }

  enforce(rule = {}, payload, payloadType) {

    let test = {
      rule,
      payload,
      payloadType
    };

    if (typeof rule.assert !== 'function') {
      
      this.console('warn', 'Rule object is missing assert method - skipping...', rule); 
      
      test.passed = true;
      return test;

    }

    test.passed = rule.assert(payload, payloadType);
    
    if (!test.passed)
      this.console('warn', `${payloadType} payload failed rule: ${rule?.name}`, test);

    return test;

  }

  callStatic(method, ...args) {
    return DataLayerCop[method].apply(this, args);
  }

  console(method, message, data) {
    console[method](`🚨 ${this.config.dataLayer} Cop - ${message}`, data);
  }

  isArgumentsObject(item) {
    return Object.prototype.toString.call(item) === '[object Arguments]';
  }

  isValidUrl(string) {
    
    try {
      var url = new URL(string);
    } catch (error) {
      return false;  
    }

    return url.protocol === 'https:';

  }

  static getCommonPattern(pattern) {
    
    switch (pattern) {
      case 'snake':
        return /^[a-z0-9_]+$/;
      case 'camel':
        return /^[a-z0-9]+([A-Z][a-z0-9]+)*$/;
      case 'pascal':
        return /^[A-Z][a-z0-9]+([A-Z][a-z0-9]+)*$/;
      case 'namespaced':
        return /^([a-zA-Z0-9_]+\.)/;
      default:
        return pattern;
    }

  }

  isPreferredCase(string) {
    return DataLayerCop.getCommonPattern(this.config.preferredCase).test(string);
  }

  static isObjectLiteral(input) {

    var _test  = input;

    return ( typeof input !== 'object' || input === null ?
                false :  
                (
                  (function () {

                    while (!false) {
                      if (Object.getPrototypeOf(_test = Object.getPrototypeOf(_test)) === null) {
                        break;
                      }      
                    }

                    return Object.getPrototypeOf(input) === _test;

                  })()
                )
            );

  }

  static isSnakeCase(string) {
    return DataLayerCop.getCommonPattern('snake').test(string);
  }

  static isCamelCase(string) {
    return DataLayerCop.getCommonPattern('camel').test(string);
  }

  static isPascalCase(string) {
    return DataLayerCop.getCommonPattern('pascal').test(string);
  }

  static isNamespaced(string) {
    return DataLayerCop.getCommonPattern('namespaced').test(string);
  }

}