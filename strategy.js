let z = require('zero-fill')
    , n = require('numbro')
    , rsi = require('../../../lib/rsi')
    , srsi = require('../../../lib/srsi')
    , sma = require('../../../lib/sma')
    , crossover = require('../../../lib/helpers').crossover
    , crossunder = require('../../../lib/helpers').crossunder
    , Phenotypes = require('../../../lib/phenotype')

module.exports = {
    name: 'zenbot_power_x',
    description: 'PowerX Strategy',

    getOptions: function () {
        this.option('period', 'period length, same as --period_length', String, '30m')
        this.option('period_length', 'period length, same as --period', String, '30m')
        this.option('min_periods', 'min. number of history periods', Number, 26)

        this.option('rsi_periods', 'number of RSI periods', Number, 14)
        this.option('ssl_periods', 'number of RSI periods', Number, 10)

        this.option('srsi_k', '%K line', Number, 14)
        this.option('srsi_d', '%D line', Number, 3)

        this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 50)

        this.option('sma_short_period', 'number of periods for the shorter SMA', Number, 12)
        this.option('sma_long_period', 'number of periods for the longer SMA', Number, 26)
        this.option('signal_period', 'number of periods for the signal SMA', Number, 9)


    },

    calculate: function (s) {

        // compute RSI
        rsi(s, 'rsi', s.options.rsi_periods)

        // compute Stochastic RSI
        srsi(s, 'srsi', s.options.rsi_periods, s.options.srsi_k, s.options.srsi_d)

        // compute MACD
        sma(s, 'sma_short', s.options.sma_short_period)
        sma(s, 'sma_long', s.options.sma_long_period)
        if (s.period.sma_short && s.period.sma_long) {
            s.period.macd = (s.period.sma_short - s.period.sma_long)
            sma(s, 'signal', s.options.signal_period, 'macd')
            if (s.period.signal) {
                s.period.macd_histogram = s.period.macd - s.period.signal
            }
        }

        sma(s, 'ssl_high', s.options.ssl_periods, 'high')
        sma(s, 'ssl_low', s.options.ssl_periods, 'low')

        s.Hlv = s.period.close > s.period.ssl_high ? 1 : s.period.close < s.period.ssl_low ? -1 : 0
        s.period.sslDown = s.Hlv < 0 ? s.period.ssl_high : s.period.ssl_low
        s.period.sslUp   = s.Hlv < 0 ? s.period.ssl_low : s.period.ssl_high

        if (crossover(s, 'sslUp', 'sslDown')) {

            s.ssl_trigger = true
        }
        else if (crossunder(s, 'sslUp', 'sslDown')) {

            s.ssl_trigger = false
        }

        if (crossover(s, 'srsi_K', 'srsi_D')) {

            s.srsi_crossover = true
        }
        else if (crossunder(s, 'srsi_K', 'srsi_D') && s.period.srsi_K > s.options.oversold_rsi) {

            s.srsi_crossover = false
        }
    },

    onPeriod: function (s, cb) {
        if (!s.in_preroll) {

            if (typeof s.period.macd_histogram === 'number' && typeof s.lookback[0].macd_histogram === 'number' && typeof s.period.srsi_K === 'number' && typeof s.period.srsi_D === 'number') {

                if (s.srsi_crossover == true && s.ssl_trigger == true && s.period.rsi > s.options.oversold_rsi) {

                    s.ssl_trigger = null
                    s.srsi_crossover = null
                    s.signal = 'buy'
                    return cb();
                }

                if (s.srsi_crossover == false && s.ssl_trigger == false && s.period.rsi <= s.options.oversold_rsi) {

                    s.ssl_trigger = null
                    s.srsi_crossover = null
                    s.signal = 'sell'
                    return cb();
                }
                else {

                    s.signal = null
                    return cb();
                }
            }
        }
        cb()
    },
    onReport: function (s) {
        var cols = []
        if (typeof s.period.macd_histogram === 'number') {
            var color = 'grey'
            if (s.period.macd_histogram > 0) {
                color = 'green'
            }
            else if (s.period.macd_histogram < 0) {
                color = 'red'
            }
            cols.push(z(8, n(s.period.macd_histogram).format('+00.0000'), ' ')[color])
            cols.push(z(8, n(s.period.srsi_K).format('00.00'), ' ').cyan)
            cols.push(z(8, n(s.period.srsi_D).format('00.00'), ' ').yellow)
        }
        else {
            cols.push('         ')
        }
        return cols
    },

    phenotypes: {
        // -- common
        period_length: Phenotypes.RangePeriod(1, 120, 'm'),
        min_periods: Phenotypes.Range(1, 200),
        markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
        markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
        order_type: Phenotypes.ListOption(['maker', 'taker']),
        sell_stop_pct: Phenotypes.Range0(1, 50),
        buy_stop_pct: Phenotypes.Range0(1, 50),
        profit_stop_enable_pct: Phenotypes.Range0(1, 20),
        profit_stop_pct: Phenotypes.Range(1, 20),

        // -- strategy
        rsi_periods: Phenotypes.Range(1, 200),
        srsi_periods: Phenotypes.Range(1, 200),
        srsi_k: Phenotypes.Range(1, 50),
        srsi_d: Phenotypes.Range(1, 50),
        oversold_rsi: Phenotypes.Range(1, 100),
        overbought_rsi: Phenotypes.Range(1, 100),
        sma_short_period: Phenotypes.Range(1, 20),
        sma_long_period: Phenotypes.Range(20, 100),
        signal_period: Phenotypes.Range(1, 20),
        up_trend_threshold: Phenotypes.Range(0, 20),
        down_trend_threshold: Phenotypes.Range(0, 20)
    }
}