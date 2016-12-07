$(function () {
  log('Requesting Capability Token...');
  $.getJSON('/token')
    .done(function (data) {
      log('Got a token.');
      console.log('Token: ' + data.token);

      // Setup Twilio.Device
      Twilio.Device.setup(data.token);

      Twilio.Device.ready(function (device) {
        log('Twilio.Device Ready!');
        document.getElementById('call-controls').style.display = 'block';
      });

      Twilio.Device.error(function (error) {
        log('Twilio.Device Error: ' + error.message);
      });

      Twilio.Device.connect(function (conn) {
        log('Successfully established call!');
        document.getElementById('button-call').style.display = 'none';
        document.getElementById('button-hangup').style.display = 'inline';
      });

      Twilio.Device.disconnect(function (conn) {
        log('Call ended.');
        document.getElementById('button-call').style.display = 'inline';
        document.getElementById('button-hangup').style.display = 'none';
      });

      Twilio.Device.incoming(function (conn) {
        log('Incoming connection from ' + conn.parameters.From);
        var archEnemyPhoneNumber = '+12099517118';

        if (conn.parameters.From === archEnemyPhoneNumber) {
          conn.reject();
          log('It\'s your nemesis. Rejected call.');
        } else {
          // accept the incoming connection and start two-way audio
          conn.accept();
        }
      });

      setClientNameUI(data.identity);
    })
    .fail(function () {
      log('Could not get a token from server!');
    });

  // Bind button to make call
  document.getElementById('button-call').onclick = function () {
    // get the phone number to connect the call to
    var params = {
      To: document.getElementById('phone-number').value
    };

    console.log('Calling ' + params.To + '...');
    Twilio.Device.connect(params);
  };

  // Bind button to hangup call
  document.getElementById('button-hangup').onclick = function () {
    log('Hanging up...');
    Twilio.Device.disconnectAll();
  };

});

// Activity log
function log(message) {
  var logDiv = document.getElementById('log');
  logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Set the client name in the UI
function setClientNameUI(clientName) {
  var div = document.getElementById('client-name');
  div.innerHTML = 'Your client name: <strong>' + clientName +
    '</strong>';
}

function registerTaskRouterCallbacks() {
  worker.on('ready', function(worker) {
      agentActivityChanged(worker.activityName);
      logger("Successfully registered as: " + worker.friendlyName)
      logger("Current activity is: " + worker.activityName);
  });

  worker.on('activity.update', function(worker) {
      agentActivityChanged(worker.activityName);
      logger("Worker activity changed to: " + worker.activityName);
  });

  worker.on("reservation.created", function(reservation) {
      logger("-----");
      logger("You have been reserved to handle a call!");
      logger("Call from: " + reservation.task.attributes.from);
      logger("Selected language: " + reservation.task.attributes.selected_language);
      logger("-----");
  });

  worker.on("reservation.accepted", function(reservation) {
      logger("Reservation " + reservation.sid + " accepted!");
  });

  worker.on("reservation.rejected", function(reservation) {
      logger("Reservation " + reservation.sid + " rejected!");
  });

  worker.on("reservation.timeout", function(reservation) {
      logger("Reservation " + reservation.sid + " timed out!");
  });

  worker.on("reservation.canceled", function(reservation) {
      logger("Reservation " + reservation.sid + " canceled!");
  });
}

        /* Hook up the agent Activity buttons to TaskRouter.js */

function bindAgentActivityButtons() {
    // Fetch the full list of available Activities from TaskRouter. Store each
    // ActivitySid against the matching Friendly Name
    var activitySids = {};
    worker.activities.fetch(function(error, activityList) {
        var activities = activityList.data;
        var i = activities.length;
        while (i--) {
            activitySids[activities[i].friendlyName] = activities[i].sid;
        }
    });

    /* For each button of class 'change-activity' in our Agent UI, look up the
     ActivitySid corresponding to the Friendly Name in the button’s next-activity
     data attribute. Use Worker.js to transition the agent to that ActivitySid
     when the button is clicked.*/
    var elements = document.getElementsByClassName('change-activity');
    var i = elements.length;
    while (i--) {
        elements[i].onclick = function() {
            var nextActivity = this.dataset.nextActivity;
            var nextActivitySid = activitySids[nextActivity];
            worker.updateActivity(nextActivitySid);
        }
    }
}

/* Update the UI to reflect a change in Activity */

function agentActivityChanged(activity) {
    hideAgentActivities();
    showAgentActivity(activity);
}

function hideAgentActivities() {
    var elements = document.getElementsByClassName('agent-activity');
    var i = elements.length;
    while (i--) {
        elements[i].style.display = 'none';
    }
}

function showAgentActivity(activity) {
    activity = activity.toLowerCase();
    var elements = document.getElementsByClassName(('agent-activity ' + activity));
    elements.item(0).style.display = 'block';
}

/* Other stuff */

function logger(message) {
    var log = document.getElementById('tlog');
    log.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
    log.scrollTop = log.scrollHeight;
}

window.onload = function() {
    // Initialize TaskRouter.js on page load using window.workerToken -
    // a Twilio Capability token that was set from rendering the template with agents endpoint
    logger("Initializing...");
    window.worker = new Twilio.TaskRouter.Worker("{{ worker_token }}");

    registerTaskRouterCallbacks();
    bindAgentActivityButtons();
};

function number_write(number) {
    var text_box = document.getElementById("phone-number");
    if (number >= 0 && number <= 9){
        if(isNaN(text_box.value)){
            text_box.value = 0;
        }
        text_box.value = (text_box.value * 10) + number;
    }
}

function number_clear() {
    var text_box = document.getElementById("phone-number");
    test_box.value = 0;
}

function number_del() {
    var text_box = document.getElementById("phone-number");
    text_box.value = (text_box.value - text_box.value % 10) / 10;
}