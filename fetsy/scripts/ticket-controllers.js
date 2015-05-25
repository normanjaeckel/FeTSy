(function () {

'use strict';

angular.module( 'FeTSyTicketControllers', [ 'ui.bootstrap', 'FeTSyTicketTableHead' ] )

// Setup TicketListCtrl, the main controller for this project.
.controller( 'TicketListCtrl', [
    '$document',
    '$http',
    '$modal',
    '$q',
    '$timeout',
    'setupTableSearchAndSort',
    function ( $document, $http, $modal, $q, $timeout, setupTableSearchAndSort ) {
        var ticketCtrl = this;

        // Setup ticket manage permission for the current user. Get the
        // permission info from the rendered template.
        ticketCtrl.userAddPerm = userPerms['fetsy.add_ticket'];
        ticketCtrl.userChangePerm = userPerms['fetsy.change_ticket'];

        // Setup empty tag and user array. They are filled later during an
        // OPTIONS request.
        ticketCtrl.allTags = [];
        ticketCtrl.allUsers = [];

        // Run setupTableSearchAndSort factory. This sets among other things
        // ticketCtrl.showRemainingTimeInMinutes and ticketCtrl.showClosed.
        setupTableSearchAndSort(ticketCtrl);

        // Setup Ticket constructor.
        // Add REST API data to ticket and update properties.
        var Ticket = function ( data ) {
            var ticket = this;
            angular.extend(ticket, data);
            ticket.updateProperties();
        };

        // Helper function to update some calculated properties.
        Ticket.prototype.updateProperties = function () {
            var ticket = this;
            var created = new Date(ticket.created);

            // Set title for info popover.
            ticket.title = 'Ticket #' + ticket.id + ' | ' + created.toLocaleString();

            // Caluclate deadline and the properties deadlineTimeDeltaMinutes
            // and deadlineDateString.
            ticket.deadline = created.getTime() + ticket.period * 60 * 1000;
            ticket.deadlineTimeDeltaMinutes = Math.trunc((ticket.deadline - Date.now()) / 1000 / 60);

            var deadlineDate = new Date(ticket.deadline);
            if ( new Date().getDate() == deadlineDate.getDate() ) {
                ticket.deadlineDateString = 'Today' + ' ' + deadlineDate.toLocaleTimeString().slice(0,-3);
            } else if ( new Date().getDate() + 1 == deadlineDate.getDate() ) {
                ticket.deadlineDateString = 'Tomorrow' + ' ' + deadlineDate.toLocaleTimeString().slice(0,-3);
            } else {
                ticket.deadlineDateString = deadlineDate.toLocaleString().slice(0,-3);
            }

            // Add tmpContent, tmpTags and tmpPeriod properties. These are
            // only used for the change form and updated via AngularJS's magic.
            ticket.tmpContent = ticket.content;
            ticket.tmpTags = ticket.tags;
            ticket.tmpPeriod = ticket.period;
        };

        // Limit of length of content in the table. If the content is longer, some
        // dots are added.
        ticketCtrl.limit = 30;

        // Add isLong function to determine whether to print dots in content cell.
        Ticket.prototype.isLong = function () {
            var ticket = this;
            return ticket.content.length > ticketCtrl.limit;
        };

        // Add change function. The argument changedData is required. These data are
        // sent to the REST API.
        Ticket.prototype.change = function ( changedData ) {
            var ticket = this;
            $http.patch( [ baseRestUrl, 'tickets', ticket.id, '' ].join('/'), changedData )
                .success(function ( data, status, headers, config ) {
                    angular.extend(ticket, data);
                    ticket.updateProperties();
                })
                .error(function ( data, status, headers, config ) {
                    alert('There was an error. Please reload the page.');
                });
        };

        // TODO: Move this to an extra service.
        //
        // Fetch all ticket data from the REST API.
        // First it fetches Options from the REST API and save them into
        // ticketCtrl.options. Uses a timeout to check whether the user is
        // idle and fetches data from server again.

        // Timeout and watching.
        ticketCtrl.startWatch = function () {
            var timer = $timeout(function () {}, 5000);
            timer.then(
                function () {
                    ticketCtrl.fetch();
                },
                function () {
                    ticketCtrl.startWatch();
                }
            );
            var events = 'mousemove keydown DOMMouseScroll mousewheel mousedown touchstart touchmove scroll';
            $document.find('body').on(events, function() {
                $document.find('body').off(events);
                $timeout.cancel(timer);
            });
        };

        // Fetching all ticket data.
        ticketCtrl.fetch = function () {
            $http.get([ baseRestUrl, 'tickets', '' ].join('/'))
                .success(function ( data, status, headers, config ) {
                    // Construct tickets and push them to scope.
                    ticketCtrl.tickets = [];
                    for (var index in data) {
                        var ticket = new Ticket(data[index]);
                        ticketCtrl.tickets.push(ticket);
                    }
                    ticketCtrl.startWatch();
                })
                .error(function ( data, status, headers, config ) {
                    alert('There was an error. Please reload the page.');
                });
        };

        // Fetching options for list URL.
        ticketCtrl.optionsFetch = function ( isRetrieveOptionsFetch ) {
            var methodKey = isRetrieveOptionsFetch ? 'PUT' : 'POST';
            var url = [ baseRestUrl, 'tickets', '' ].join('/');
            if ( isRetrieveOptionsFetch ) {
                // TODO: Do not assume ticket #1 existing but take only one
                //       possbible ticket.
                url +=  '1/';
            }
            return $http({ 'method': 'OPTIONS', 'url': url })
                .success(function ( data, status, headers, config ) {
                    // Save option data. Copy data for te key POST or PUT to the key METHOD.
                    ticketCtrl.options = data;
                    ticketCtrl.options.actions.METHOD = ticketCtrl.options.actions[methodKey];

                    // Save special rendered tag and usersoptions to ticketCtrl.allTags and ticketCtrl.allUsers.
                    // TODO: Do not use eval but think about fixings this pseudo JSON.
                    angular.forEach(ticketCtrl.options.actions.METHOD.tags.choices, function ( value ) {
                        ticketCtrl.allTags.push(eval('(' + value.value + ')'));
                    });
                    angular.forEach(ticketCtrl.options.actions.METHOD.assignee.choices, function ( value ) {
                        ticketCtrl.allUsers.push(eval('(' + value.value + ')'));
                    });
                })
                .error(function ( data, status, headers, config ) {
                    alert('There was an error. Please reload the page.');
                });
        };

        // Now go: Make single options fetch and then ticket fetch and start timeout.
        var promisses = [];
        if ( ticketCtrl.userAddPerm ) {
            promisses.push(ticketCtrl.optionsFetch(false));
        } else if ( ticketCtrl.userChangePerm ) {
            promisses.push(ticketCtrl.optionsFetch(true));
        }
        $q.all(promisses).then(ticketCtrl.fetch);

        // Setup form for a new ticket via angular ui bootstrap modal.
        ticketCtrl.newTicketForm = function () {
            var modalInstance = $modal.open({
                templateUrl: 'newTicketForm.html',
                controller: 'NewTicketFormModalCtrl as newTicketFormModalCtrl',
                resolve: {
                    allTags: function () {
                        return ticketCtrl.allTags;
                    },
                    showRemainingTimeInMinutes: function () {
                        return ticketCtrl.showRemainingTimeInMinutes;
                    }
                }
            });
            modalInstance.result.then(function ( dataToSend ) {
                dataToSend.status = ticketCtrl.options.actions.METHOD.status.choices[0].value;
                $http.post( [ baseRestUrl, 'tickets', '' ].join('/'), dataToSend )
                    .success(function ( data, status, headers, config ) {
                        var ticket = new Ticket(data);
                        ticketCtrl.tickets.push(ticket);
                    })
                    .error(function ( data, status, headers, config ) {
                        alert('There was an error. Please reload the page.');
                    });
            });
        };

    }
])

// Setup controler for form for a new ticket (NewTicketFormModalCtrl).
.controller( 'NewTicketFormModalCtrl', [
    '$modalInstance',
    'allTags',
    'showRemainingTimeInMinutes',
    function ( $modalInstance, allTags, showRemainingTimeInMinutes ) {
        // Default period is 120 minutes.
        var defaultPeriod = 120;
        this.showRemainingTimeInMinutes = showRemainingTimeInMinutes;
        this.periodDeadlineField = this.showRemainingTimeInMinutes ? String(defaultPeriod) : new Date(Date.now() + defaultPeriod * 60 * 1000).toLocaleTimeString().slice(0,-3);
        this.tags = [];
        this.allTags = allTags;
        this.save = function () {
            // Validate period or deadline input field depending on
            // showRemainingTimeInMinutes flag.
            var regex = this.showRemainingTimeInMinutes ? /^[0-9]+$/ : /^[0-2][0-9]:[0-5][0-9]$/;
            var periodDeadlineFieldMatch = this.periodDeadlineField.match(regex);
            if ( !this.showRemainingTimeInMinutes && periodDeadlineFieldMatch && this.periodDeadlineField.split(':')[0] > 23 ) {
                periodDeadlineFieldMatch = null;
            }
            // Save ticket if the period or deadline field is valid and there
            // is some content.
            if ( periodDeadlineFieldMatch && this.content ) {
                var period;
                if ( showRemainingTimeInMinutes ) {
                    // Just take the given value as period.
                    period = this.periodDeadlineField;
                } else {
                    // Caluclate time delta between now and given time.
                    var now = new Date();
                    period = (this.periodDeadlineField.split(':')[0] - now.getHours()) * 60 + (this.periodDeadlineField.split(':')[1] - now.getMinutes());
                    if ( period <= 0 ) {
                        // If negative assume the next day so add 24 * 60 = 1440 minutes.
                        period += 1440;
                    }
                }
                $modalInstance.close({ 'content': this.content, 'period': period, 'tags': this.tags });
            } else {
                $modalInstance.dismiss('cancel');
            }
        };
        this.cancel = function () {
            $modalInstance.dismiss('cancel');
        };
    }
]);

}());
