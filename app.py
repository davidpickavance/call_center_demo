import os, re;
from flask import Flask, jsonify, request, Response, render_template
from faker import Factory
from twilio.util import TwilioCapability
from twilio.rest import TwilioTaskRouterClient
from twilio.rest import TwilioRestClient
from twilio.task_router import TaskRouterWorkerCapability
import twilio.twiml
import json

app = Flask(__name__)
fake = Factory.create()
alphanumeric_only = re.compile('[\W_]+')
phone_pattern = re.compile(r"^[\d\+\-\(\) ]+$")

voice_workflow_sid = "WWdd39202d83add0db3cc824f547a33870"
workspace_sid = "WS9842cc918b356da74bf34adc105c3487"
account_sid = os.environ['TWILIO_ACCOUNT_SID']
auth_token = os.environ['TWILIO_AUTH_TOKEN']
application_sid = os.environ['TWILIO_TWIML_APP_SID']
taskrouterclient = TwilioTaskRouterClient(account_sid, auth_token)
restclient = TwilioRestClient(account_sid, auth_token)

@app.route('/')
def index():
    # For this very basic demo, we're going add taskrouter.js for
    # a fixed worker. In a real call center, we would ask the user
    # to log on and find which worker they are from a database
    worker_sid = "WKff0e117adef769bd5189da92a8676dcc"

    worker_capability = TaskRouterWorkerCapability(account_sid, auth_token, workspace_sid, worker_sid)
    worker_capability.allow_activity_updates()
    worker_capability.allow_reservation_updates()

    worker_token = worker_capability.generate_token()

    return render_template('index.html', worker_token=worker_token)

@app.route('/token', methods=['GET'])
def token():
    # get credentials for environment variables
    
    # Generate a random user name
    identity = alphanumeric_only.sub('', fake.user_name())

    # Create a Capability Token
    capability = TwilioCapability(account_sid, auth_token)
    capability.allow_client_outgoing(application_sid)
    capability.allow_client_incoming(identity)
    token = capability.generate()

    # Return token info as JSON
    return jsonify(identity=identity, token=token)

    
@app.route("/voice", methods=['POST'])
def voice():
    resp = twilio.twiml.Response()
    if "To" in request.form and request.form["To"] != '':
        dial = resp.dial(callerId=os.environ['TWILIO_CALLER_ID'])
        # wrap the phone number or client name in the appropriate TwiML verb
        # by checking if the number given has only digits and format symbols
        if phone_pattern.match(request.form["To"]):
            dial.number(request.form["To"])
        else:
            dial.queue(request.form["To"])
    else:
        resp.say("Thanks for calling!")

    return Response(str(resp), mimetype='text/xml')

@app.route("/incoming_from_pstn", methods=['POST'])
def incoming_from_pstn():
    resp=twilio.twiml.Response()
    with resp.gather(numDigits=1, action="/ivr_first_level") as g:
        g.say("Welcome do your demo call center. Press one for sales or two for support.", voice="alice")
    return Response(str(resp), mimetype='text/xml')

@app.route("/ivr_first_level", methods=['POST'])
def ivr_first_level():
    resp = twilio.twiml.Response()

    #if "From" in request.form and request.form["From"] != "":
    #    caller_id = request.form["From"]
    #else:
    #    caller_id = "Unknown"

    if "Digits" in request.form and request.form["Digits"] == "1":
        #dial = resp.dial(callerId=caller_id)
        #dial.client("ecassin")
        with resp.enqueue(None, workflowSid=voice_workflow_sid) as e:
            e.task('{"required_dept":"sales"}')
    elif "Digits" in request.form and request.form["Digits"] == "2":
        #dial = resp.dial(callerId=caller_id)
        #dial.client("support")
        with resp.enqueue(None, workflowSid=voice_workflow_sid) as e:
            e.task('{"required_dept":"support"}')
    else:
        resp.say("Sorry, I did not understand your choice.", voice="alice")
        resp.redirect("/incoming_from_pstn")
    return Response(str(resp), mimetype='text/xml')

@app.route("/assignment_callback_OK", methods=['POST'])
def assignment_callback():
    """Respond to assignment callbacks with an acceptance 200 response"""

    #print request.form.keys()
    #print request.form['WorkerAttributes']
    contact_uri = json.loads(request.form['WorkerAttributes'])["contact_uri"]
    caller_id = json.loads(request.form["TaskAttributes"])["from"]
    print contact_uri
    print caller_id
    ret = '{"instruction": "dequeue", "from": "' + caller_id + '"}'
    resp = Response(response=ret, status=200, mimetype='application/json')
    return resp

if __name__ == '__main__':
    app.run(debug=True)