// Karma configuration file, see link for more information
// https://karma-runner.github.io/6.4/config/configuration-file.html

// Set CHROME_BIN based on platform (macOS vs Linux/CI)
if (!process.env.CHROME_BIN) {
  if (process.platform === 'darwin') {
    process.env.CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else {
    process.env.CHROME_BIN = '/usr/bin/google-chrome-stable';
  }
}

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('karma-junit-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    junitReporter: {
      outputDir: './',
      outputFile: 'TESTS-junit.xml',
      useBrowserName: false
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    // Custom launcher for CI/Docker environments (headless with no-sandbox)
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-translate',
          '--disable-extensions',
          '--disable-dev-shm-usage'
        ]
      }
    },
    restartOnFileChange: true,

    // Timeout settings for CI environments under load
    browserNoActivityTimeout: 120000,    // 2 min (default: 30s) - wait for test activity
    browserDisconnectTimeout: 30000,     // 30s (default: 2s) - wait for reconnect
    browserDisconnectTolerance: 3,       // Allow 3 disconnects before failing
    captureTimeout: 120000               // 2 min - wait for browser to connect
  });
};
