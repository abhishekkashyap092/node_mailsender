
// ---------------- define generic variables, so you won't need to search them across this file --------------
var argv = require('minimist')(process.argv.slice(2));
var infile = argv.infile;
var email_template = argv.email_template;

var email_from = argv.email_from;
var email_reply = argv.email_reply_to;
var email_subject = argv.email_subject;
var smtp_server = argv.smtp_server;

var behave = argv.behave; // fill_queue / deliver_queue
console.log('got arguments: ');
console.log(argv);
var bunyan = require('bunyan');
var nodemailer = require('nodemailer');
var smtpPool = require('nodemailer-smtp-pool');
var fs = require('fs'),
    readline = require('readline');

var transporter = nodemailer.createTransport(smtpPool({
  maxConnections: 4,
  maxMessages: 10,
  host: smtp_server,
  secure: false,
  ignoreTLS: true,
  port: 25,
}));

// kue
var kue = require('kue');
var queue = kue.createQueue({
  redis: {
    host: 'redis',
  }
});


var log = bunyan.createLogger(
    {
      name: "mailsender",
      streams: [
      {
        level: 'info',
        path: 'mailsender.log'
      },
      {
        level: 'info',
        stream: process.stdout
      }
      ]

    });

// reset counters
var email_total = 0;
var email_sent = 0;

// ---- count the number of emails we will send ----
var csv_file = fs.readFileSync(infile).toString().split("\n");
for (i in csv_file) {
  email_total += 1;
}
email_total -= 1;

// ---- open a file descriptor for the csv -----
var rd = readline.createInterface({
  input: fs.createReadStream(infile),
  output: process.stdout,
  terminal: false
});

// ----- read the template file into a variable ------
console.log('email template file: ' + email_template);
var email_torzs = fs.readFileSync(email_template).toString();
var textfile = email_template;

log.info('function: ' + behave);

kue.Job.rangeByType ('email', 'failed', 0, 10, 'asc', function (err, selectedJobs) {
  selectedJobs.forEach(function (job) {
    console.log(job.id + ', ' + job._state);
    job.remove(function(err){
      if (err) throw err;
      console.log('removed failed job #%d, email to: ' + job.data.email_to, job.id);
    });
  });
});

// process queue
if ( behave == 'deliver_queue') {
  queue_cnt = 0;
  log.info('delivering queue');
  // get active job count and exit when it's empty
  queue.inactiveCount(function(err, total) {
        console.log('inactive count before start proccessing queue: ' + total);
        if(total == 0) {
            log.info('no inactive job in the queue; nothing to do, exiting');
            process.exit(1);
        }
  });
  queue.process('email', function(job, done) {
  queue.activeCount(function(err, total) {
        console.log('active count: ' + total);
  });
  queue.inactiveCount(function(err, total) {
        console.log('inactive count: ' + total);
  });
  queue.failedCount(function(err, total) {
        console.log('failed count: ' + total);
  });
  queue.completeCount(function(err, total) {
        console.log('complete count: ' + total);
  });
    queue_cnt += 1;
    console.log('queue processing: ' + queue_cnt);
    var mailOptions = {
      from: job.data.email_from,
      replyTo: job.data.email_reply,
      to: job.data.email_to,
      subject: job.data.email_subject,
      html: job.data.email_text
    };
    transporter.sendMail(mailOptions, function(error, info){
      if(error){
        done(new Error(error));
        return log.info(error);
      }
      email_sent += 1;
      log.info('[' + email_sent + '/' + email_total + '] Message sent to ' + job.data.email_to  +': ' + info.response);
      done();

  queue.inactiveCount(function(err, total) {
        console.log('inactive count while sending mail: ' + total);
        if(total == 0) {
            log.info('no more inactive job in queue, exiting.');
            process.exit(1);
        }
  });
    });
  });
}

// ----- connect to redis and fill the queue -----------
if ( behave == 'fill_queue' ) {
  var queue_cnt = 0;
  log.info('filling queue with ' + email_total + ' messages');
  rd.on('line', function(line) {

    var data = line.split(";");
    var email = data[0];
    var content1 = data[1];


    // -------- replace the template variable with we found in the csv file --------------
    var text = email_torzs.replace('__CONTENT1__',content1);
    var job = queue.create('email', {
      email_subject: email_subject,
      email_to: email,
      email_text: text,
      email_from: email_from,
      email_reply: email_reply,
    });
    job.attempts(8).backoff( {delay: 5*1000, type:'fixed'} );
    job.save( function(err){
      if( !err ) {
        queue_cnt += 1;
        console.log( '[' + queue_cnt + '] queued ' + job.id );
      } else {
        log.info('Error queueing: ' + job.id);
      }
      console.log(queue_cnt + " / " + email_total);
      if(queue_cnt == email_total) {
        log.info('queue is filled, exiting. ');
        process.exit(1);
      }
    });


    // -------- construct the message ------------
    var mailOptions = {
      from: email_from,
      replyTo: email_reply,
      to: email,
      subject: email_subject,
      html: text
    };
  });
}

