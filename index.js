/*
 * http-rewrite-middleware
 * https://github.com/viart/http-rewrite-middleware
 *
 * Copyright (c) 2014 Artem Vitiuk
 * Licensed under the MIT license.
 */
'use strict';

function Rewriter(rules, options) {
    options = options || {};

    var nop = function () {};
    if (options.silent) {
        this.log = {
            ok: nop,
            error: nop,
            verbose: nop
        };
    } else {
        this.log = {
            ok: console.log,
            error: console.error,
            verbose: options.verbose ? console.log : nop
        };
    }

    this.rules = [];
    (rules || []).forEach(this.registerRule, this);
}

Rewriter.prototype = {
    registerRule: function (rule) {
        var type = 'rewrite';

        rule = rule || {};

        if (this.isRuleValid(rule)) {
            if (rule.redirect) {
                rule.redirect = rule.redirect ? rule.redirect : 302;
                type = 'redirect ' + rule.redirect;
            }

            this.rules.push({
                condition: (rule.condition) ? rule.condition : false,
                from: new RegExp(rule.from),
                to: rule.to,
                redirect: rule.redirect
            });

            this.log.ok('[RW] Rewrite rule created for: [' + type.toUpperCase() + ': ' + rule.from + ' -> ' + rule.to + '].');
            return true;
        } else {
            this.log.error('[RW] Wrong rule given.');
            return false;
        }
    },

    isRuleValid: function (rule) {
        return rule.from && rule.to && typeof rule.from === 'string' && typeof rule.to === 'string';
    },

    resetRules: function () {
        this.rules = [];
    },

    getRules: function () {
        return this.rules;
    },

    dispatcher: function (req, res, next) {
        var logger = this.log.verbose;
        return function (rule) {
            var toUrl,
                fromUrl = req.url,
                conditionPassed = false;

            if (rule.condition !== false) {
                var validate = rule.condition.split(/^%{REQUEST_(\w+)} (.+)$/m);
                var method = (validate[1]) ? validate[1] : false;
                method = (method) ? method.toLowerCase() : false;
                var pattern = (validate[2]) ? new RegExp(validate[2], 'm') : false;
                conditionPassed = (method && pattern) ? req[method].match(pattern) : false;

            } else {
                conditionPassed = true;
                rule.condition = 'No condition';
            }

            if (conditionPassed) {
                if (rule.from.test(req.url)) {

                    logger('[RW] Valid match: [' + rule.condition + '].');
                    logger('[RW] Rule to: [' + rule.to + ': ' + rule.from + ' -> ' + rule.to + '].');

                    var newTo = rule.to.replace('%{REQUEST_METHOD}', req.method);
                    toUrl = req.url.replace(rule.from, newTo);

                    if (!rule.redirect) {
                        req.url = toUrl;
                        next();
                    } else {
                        res.statusCode = rule.redirect;
                        res.setHeader('Location', toUrl);
                        res.end();
                    }
                    logger('[RW] ' +
                        (rule.redirect ? 'redirect ' + rule.redirect : 'rewrite').toUpperCase() + ' > ' +
                        fromUrl + ' -> ' + toUrl + ' | By [' + rule.from + ' : ' + rule.to + ']'
                    );
                    return true;
                }
            }
        };
    },

    getMiddleware: function () {
        return function (req, res, next) {
            if (!this.rules.length || !this.rules.some(this.dispatcher(req, res, next))) {
                next();
            }
        }.bind(this);
    }
};

module.exports.getMiddleware = function (rules, options) {
    return (new Rewriter(rules, options)).getMiddleware();
};

module.exports.Rewriter = Rewriter;
