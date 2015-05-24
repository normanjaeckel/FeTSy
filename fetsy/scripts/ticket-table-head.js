(function () {

'use strict';

angular.module( 'FeTSyTicketTableHead', [] )

// Factory to setup ticket table headers with sort functionality and also
// search bar and checkbox.
.factory( 'setupTableSearchAndSort' , function () {
    return function ( ticketCtrl ) {
        // Setup show remaining time in minutes checkbox default value.
        ticketCtrl.showRemainingTimeInMinutes = true;

        // Use a constructor for table headers.
        var Header = function ( sortKey, verboseName, iconCSSClass ) {
            this.sortKey = sortKey;
            this.verboseName = verboseName;
            this.iconCSSClass = iconCSSClass;
        };
        Header.prototype.getVerboseName = function () {
            var header = this;
            return header.verboseName;
        };
        Header.prototype.getIconCSSClass = function () {
            var header = this;
            return header.iconCSSClass;
        };

        // Special header object for timeToEnd column.
        var timeToEndHeader = new Header('timeToEnd');
        timeToEndHeader.getVerboseName = function () {
            if ( ticketCtrl.showRemainingTimeInMinutes ) {
                return 'Remaining time';
            } else {
                return 'Deadline';
            }
        };
        timeToEndHeader.getIconCSSClass = function () {
            if ( ticketCtrl.showRemainingTimeInMinutes ) {
                return 'glyphicon-hourglass';
            } else {
                return 'glyphicon-time';
            }
        };

        // Define all other table headers and put them together.
        ticketCtrl.headers = [
            new Header('id'),
            new Header('content', 'Content', 'glyphicon-cog' ),
            new Header('status', 'Status', 'glyphicon-star'),
            new Header('priority', 'Priority', 'glyphicon-fire'),
            new Header('assignee.name', 'Assignee', 'glyphicon-user'),
            timeToEndHeader
        ];

        // Setup table filtering using the checkboxes and the search filter.
        ticketCtrl.search = undefined;
        ticketCtrl.showClosed = false;
        ticketCtrl.closedFilter = function ( value, index ) {
            return ticketCtrl.showClosed || value.status !== 'Closed';
        };

        // Setup table sorting
        ticketCtrl.sortColumn = ticketCtrl.headers[0].sortKey;
        ticketCtrl.reverse = true;
        ticketCtrl.toggleSort = function ( index ) {
            if ( ticketCtrl.sortColumn === ticketCtrl.headers[index].sortKey ) {
                ticketCtrl.reverse = !ticketCtrl.reverse;
            }
            ticketCtrl.sortColumn = ticketCtrl.headers[index].sortKey;
        };
    };
});

}());
