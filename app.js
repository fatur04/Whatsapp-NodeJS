const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  debug: true
}));


const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
	res.sendFile('index.html', { root: __dirname });
});


const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  session: sessionCfg
});

client.on('message', msg => {
    if (msg.body == 'P') {
        msg.reply('Assalamualaikum. Ga jawab dosa');
    } else if (msg.body == 'Waalaikum salam') {
      msg.reply('Cakep');
    } else if (msg.body == 'Gambar') {
    	//kirim file gambar
    	msg.reply(MessageMedia.fromFilePath('./files/image.png'));
    } else if (msg.body == 'File') {
    	//kirim file gambar
    	msg.reply(MessageMedia.fromFilePath('./files/whatsapp bot.txt'));
    } else if (msg.body == 'Doc') {
      //kirim file gambar
      msg.reply(MessageMedia.fromFilePath('./files/desain web.docx'));
    } else if (msg.body == 'Start') {
      msg.reply('Selamat datang di Whatsapp Bot by Development Patur');
      msg.reply('Ketik kata-kata berikut : ');
      msg.reply('1. P');
      msg.reply('2. Waalaikum salam');
      msg.reply('3. Gambar');
      msg.reply('4. File');
      msg.reply('5. Doc');
    }
});

client.initialize();

//socket io
io.on('connection', function(socket) {
	socket.emit('message', 'Connecting...');

	client.on('qr', (qr) => {
   		console.log('QR RECEIVED', qr);
 		qrcode.toDataURL(qr, (err, url) => {
 			socket.emit('qr', url);
 			socket.emit('message', 'QR Code received, scan please!');
 		});
	});

	client.on('ready', () => {
    	socket.emit('ready', 'Whatsapp Siap!');
    	socket.emit('message', 'Whatsapp Siap!');
	});

	client.on('authenticated', (session) => {
		socket.emit('authenticated', 'Whatsapp authenticated!');
    	socket.emit('message', 'Whatsapp authenticated!');
	    console.log('AUTHENTICATED', session);
	    sessionCfg=session;
	    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
	        if (err) {
	            console.error(err);
	        }
	    });
	});
});

const checkRegisteredNumber = async function(number) {
   const isRegistered = await client.isRegisteredUser(number);
   return isRegistered;
}

// send message
app.post('/send-Message', [
	body('number').notEmpty(),
	body('message').notEmpty(),
], async (req, res) => {
	const errors = validationResult(req).formatWith(({ msg }) => {
		return msg;
	});

	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: false,
			message: errors.mapped()
		})
	}

	const number = phoneNumberFormatter(req.body.number);
  	const message = req.body.message;

  	const isRegisteredNumber = await checkRegisteredNumber(number);

  	if (!isRegisteredNumber) {
  	 	return res.status(422).json({
  	 		status: false,
  	 		message: 'Nomer tidak ada WA'
  	 	});
  	}

	client.sendMessage(number, message).then(respone => {
		res.status(200).json({
			status: true,
			respone: respone
		});
	}).catch(err => {
		res.status(500).json({
			status: false,
			respone: err
		});
	});
});

// Send media
app.post('/send-browse', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  //kirim file url
  //const fileUrl = req.body.file;

  //kirim file gambar di folder whatsapp NodeJS
  //const media = MessageMedia.fromFilePath('./image.png');

  //kirim file dengan browse
  const file = req.files.file;
  const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  
  //kirim file url
  // let mimetype;
  // const attachment = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(response => {
  //    mimetype = response.headers['content-type'];
  //    return response.data.toString('base64');
  //  });

  // const media = new MessageMedia(mimetype, attachment, 'Media');

  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Send media
app.post('/send-url', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  //kirim file url
  const fileUrl = req.body.file;

  //kirim file gambar di folder whatsapp NodeJS
  //const media = MessageMedia.fromFilePath('./image.png');

  //kirim file dengan browse
  // const file = req.files.file;
  // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  
  //kirim file url
  let mimetype;
  const attachment = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(response => {
     mimetype = response.headers['content-type'];
     return response.data.toString('base64');
   });

  const media = new MessageMedia(mimetype, attachment, 'Media');

  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Send media
app.post('/send-files', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  //kirim file url
  //const fileUrl = req.body.file;

  //kirim file gambar di folder whatsapp NodeJS
  const media = MessageMedia.fromFilePath('./files/image.png');

  //kirim file dengan browse
  // const file = req.files.file;
  // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  
  //kirim file url
  // let mimetype;
  // const attachment = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(response => {
  //    mimetype = response.headers['content-type'];
  //    return response.data.toString('base64');
  //  });

  // const media = new MessageMedia(mimetype, attachment, 'Media');

  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

app.post('/delete', (req, res) => {
  fs.unlink('whatsapp-session.json', function(err){});
  res.end()
  });

//timer
app.get('/timer', (req, res) => {
  res.sendFile('timer.html', { root: __dirname });
  });

server.listen(8000, function() {
	console.log('App running on *: ' + 8000);
});