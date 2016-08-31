/*eslint strict: [2, "global"], global: {ga: false} */
"use strict";

(function() {

    function $(selector) {
        return document.querySelector(selector);
    }

    function reset (ev) {
        ev.preventDefault();
        alertify.reset();
    }

    function logDemo(selector) {
        (ga || function() { })("send", "event", "button", "click", "demo", selector);
    }

    function demo(selector, cb) {
        var el = $(selector);
        if(el) {
            el.addEventListener("click", function(ev) {
                ev.preventDefault();
                logDemo(selector);
                cb();
            });
        }
    }

    var ga = ga || function() {};

    // ==============================
    // Alert Dialog
    demo("#alert", function (event) {
        alertify.alert("This is an alert dialog");
    });

    // ==============================
    // Confirm Dialog
    demo("#confirm", function (event) {
        alertify
            .confirm("This is a confirm dialog",
            {
                click: function (e, ui) {
                    // The click event is in the event variable, so you can use it here.
                    e.preventDefault();

                    alertify.success("You've clicked \"OK\"");
                }
            },{
                click: function (e, ui) {
                    // The click event is in the event variable, so you can use it here.
                    e.preventDefault();

                    alertify.error("You've clicked \"Cancel\"");
                }
            });
    });

    // ==============================
    // Prompt Dialog
    demo("#prompt", function (event) {
        alertify
            .defaultValue("Default value")
            .prompt("This is a prompt dialog",
            {
                click: function (e, ui) {
                    e.preventDefault();

                    // the value entered in the prompt input
                    var inputValue = ui.getInputValue();

                    alertify.success("You've clicked \"OK\" and typed: " + inputValue);
                }
            },{
                click: function (e, ui) {
                    e.preventDefault();
                    alertify.error("You've clicked \"Cancel\"");
                }
            });
    });

    // ==============================
    // Custom Button Labels
    demo("#custom-labels", function (event) {
        alertify
            .confirm("Confirm dialog with custom button labels",
            {
                label: "Accept",
                click: function (e, ui) {
                    e.preventDefault();
                    alertify.success("You've clicked \"Accept\"");
                }
            },{
                label: "Deny",
                click: function (e, ui) {
                    e.preventDefault();
                    alertify.error("You've clicked \"Deny\"");
                }
            });
    });

    // ==============================
    // Persistent Buttons
    demo("#autoclose-buttons", function (event) {
        alertify
            .confirm("Confirm dialog with persistent buttons",
            {
                autoClose: false,
                click: function (e, ui) {
                    e.preventDefault();
                    alertify.success("This is the persistent button");
                }
            },{
                autoClose: false,
                click: function (e, ui) {
                    e.preventDefault();
                    if (true) {
                        // method to close currently open dialog
                        ui.closeDialog();
                    }
                    alertify.error("This is the persistent button, but it was closed programmatically");
                }
            });
    });

    // ==============================
    // Comprehensive dialog demo
    demo("#custom-dialog", function (event) {

        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        function createInput(value) {
            return '<input type="radio" name="quiz" id="quiz_' + value + '" value="' + value + '"><label for="quiz_' + value + '">' + value + '</label>';
        }

        function buildQuiz(ui) {
            var min = 5;
            var max = 20;
            var html = "";
            var values = [];
            var numbers = [];
            var options = [];
            var solution = 0;
            var optionsLength = 3;
            var numbersLength = getRandomInt(2, 4);
            var scatter = Math.floor((min * numbersLength) / 2);

            for (var i = 0; i < numbersLength; i++) {
                var number = getRandomInt(min, max);
                numbers.push(number);
                solution += number;
            }

            while (values.length < optionsLength) {
                var value = getRandomInt(solution - scatter, solution + scatter);
                if(value !== solution && values.indexOf(value) === -1) {
                    values.push(value);
                }
            }
            // put correct answer
            values.splice(getRandomInt(0, optionsLength - 1), 0, solution);

            for (var n = 0; n < values.length; n++) {
                options.push(createInput(values[n]));
            }

            html += numbers.join(' + ') + ' = ?';
            html += '<br><br>';
            html += options.join('<br>');

            ui.setContent(html);
            ui.centerDialog();
            ui.solution = solution;
        }

        alertify
            .dialog("Click \"New quiz\" to create new quiz.", [
            {
                type: "ok",
                label: "Test",
                autoClose: false,
                click: function (e, ui) {

                    var dialog = ui.dom.dialog;
                    var checked = dialog.querySelector('input[name="quiz"]:checked');

                    if(checked === null) {
                        alertify.error("Choose an answer from the list");
                        buildQuiz(ui);
                    } else {
                        if(ui.solution === parseInt(checked.value)) {
                            alertify.success("Correct answer!");
                            ui.closeDialog();
                        } else {
                            alertify.error("Wrong answer. Bad luck");
                            buildQuiz(ui);
                        }
                    }
                }
            },{
                label: "New quiz",
                autoClose: false,
                click: function (e, ui) {
                    buildQuiz(ui);
                },
                template: '<button data-alertify-btn style="font-weight: bold"></button>'
            },{
                type: "cancel",
                label: "Close"
            }
        ]);
    });

    // ==============================
    // Ajax - Multiple Dialog
    demo("#ajax", function (event) {
        alertify
            .confirm("Ajax requests",
            {
                autoClose: false,
                click: function (e, ui) {
                    e.preventDefault();

                    // AJAX request delay imitation
                    setTimeout(function () {

                        // updates message in the current dialog
                        ui.setMessage("Successful AJAX after \"OK\".<br>Without opening a new dialog.");

                        // center message vertically due to dialog height might be changed
                        ui.centerDialog();

                        alertify.log("Dialog message was updated using AJAX request.");
                    }, 200);
                }
            },{
                click: function (e, ui) {
                    e.preventDefault();

                    // AJAX request delay imitation
                    setTimeout(function () {

                        // notification in the new dialog window
                        alertify.alert("Successful AJAX after \"Cancel\"");
                    }, 200);
                }
            });
    });

    // ==============================
    // Promise Aware
    demo("#promise", function (event) {

        if ("function" !== typeof Promise) {
            alertify.alert("Your browser doesn't support promises");
            return;
        }

        alertify
            .confirm("Promise confirm").then(function (resolved) {
                // The click event object is accessible via "event" property.
                resolved.event.preventDefault();

                // UI object is accessible via "ui" property.
                alertify.alert("You clicked the " + resolved.ui.getButtonObject().label + " button!");
            });
    });

    demo("#click-to-close", function (event) {
        alertify
            .closeLogOnClick(true)
            .log("Click me to close!");
    });

    demo("#disable-click-to-close", function (event) {
        alertify
            .closeLogOnClick(true)
            .log("Click me to close!")
            .closeLogOnClick(false)
            .log("You can't click to close this!");
    });

    demo("#reset", function (event) {
        alertify
            .reset()
            .alert("Custom values were reset", {
                label: "Go For It!"
            });
    });

    demo("#log-template", function (event) {
        alertify
            .setLogTemplate(function (input) { return 'log message: ' + input; })
            .log("This is the message");
    });

    demo("#max-log-items", function (event) {
        alertify
            .maxLogItems(1)
            .log("This is the first message");

        // The timeout is just for visual effect.
        setTimeout(function() {
            alertify.log("The second message will force the first to close.");
        }, 1000);
    });

    // ==============================
    // Standard Dialogs
    demo("#notification", function (event) {
        alertify.log("Standard log message");
    });

    demo("#notification-html", function (event) {
        alertify.log("<img src='https://placehold.it/256x128'><h3>This is HTML</h3><p>It's great, right?</p>");
    });

    demo("#notification-callback", function(event) {
        alertify.log("Standard log message with callback", function(ev) {
            ev.preventDefault();
            alertify.log("You clicked the notification");
        });
    });

    demo("#success", function (event) {
        alertify.success("Success log message");
    });

    demo("#success-callback", function(event) {
        alertify.success("Standard log message with callback", function() {
            alertify.success("You clicked the notification");
        });
    });

    demo("#error", function (event) {
        alertify.error("Error log message");
    });

    demo("#error-callback", function(event) {
        alertify.error("Standard log message with callback", function(ev) {
            ev.preventDefault();
            alertify.error("You clicked the notification");
        });
    });

    // ==============================
    // Custom Properties
    demo("#delay", function (event) {
        alertify
            .delay(10000)
            .log("Hiding in 10 seconds");
    });

    demo("#forever", function (event) {
        alertify
            .delay(0)
            .log("Will stay until clicked");
    });

    demo("#log-position", function(event) {
        alertify.delay(1000); // This is just to make the demo go faster.
        alertify.log("Default bottom left position");
        setTimeout(function() {
            alertify.logPosition("top left");
            alertify.log("top left");
        }, 1500);
        setTimeout(function() {
            alertify.logPosition("top right");
            alertify.log("top right");
        }, 3000);
        setTimeout(function() {
            alertify.logPosition("bottom right");
            alertify.log("bottom right");
        }, 4500);
        setTimeout(function() {
            alertify.reset(); // Puts the message back to default position.
            alertify.log("Back to default");
        }, 6000);
    });

})();

var app = angular.module("alertifyDemo", ["ngAlertify"]);
app.controller("alertifyLogDemoCtrl", function($scope, $log, alertify) {

    $scope.type = "log";
    $scope.msg = "ngAlertify";
    $scope.log = alertify.log;
    $scope.error = alertify.error;
    $scope.success = alertify.success;
    $scope.maxLogItems = 2;
    $scope.delay = 5000;

    $scope.show = function(msg) {
        alertify[$scope.type](msg);
    };

    $scope.$watch("closeLogOnClick", alertify.closeLogOnClick);
    $scope.$watch("maxLogItems", alertify.maxLogItems);
    $scope.$watch("delay", alertify.delay);

});
