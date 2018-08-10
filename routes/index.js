var express = require('express');
var router = express.Router();
var expressValidator = require('express-validator');
router.use(expressValidator());
var bcrypt = require('bcryptjs');
var path = require('path');
var User = require('../models/user');
var LocalStrategy = require('passport-local').Strategy;
var passport = require('passport');
//var nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
var QuillDeltaToHtmlConverter = require('quill-delta-to-html');
var mongoose = require('mongoose');
var multer = require('multer');
var uploadNoDest = multer();
var profilePicUpload = require('../database').profilePicUpload;

var saltRounds=10;


// Get current user
router.post('/current-user', function(req, res) {
  if(req.user)
    res.send(req.user);
  else
    res.send(null);
});

// Get Homepage
router.get('/', function(req, res){
    // console.log("Homepage: ");
    // console.log(req.isAuthenticated());
    // console.log('============================================');
    // console.log("User is isAuthenticated: " + req.isAuthenticated());
    var deleted = req.flash('account-deleted');
    // console.log("User Account Deleted: " + deleted);

    if(deleted == 'true')
    {
      console.log("Rendering Deleted Account Page");
      console.log('============================================');
      res.render('account-deleted', {layout: 'dashboard-layout'});
    }else{
      console.log('============================================');
      res.render('index', {layout: 'layout'});

    }
});


// Login
router.get('/login', function(req, res){
  if(req.user) {
    res.redirect('/');
  }else{
    var username = req.flash('username');
    var error = req.flash('error');
    //username = abi
    if(username == '') {
      console.log('============================================');
      console.log("Rendering Login from Login");
      console.log("Username: blank");
      console.log('============================================');
      res.render('login', {layout: false, error: error});
    }else{
      User.getUserByUsername(username, function(err, user) {
        if(err) throw err;
        if(user) {
          // console.log('User exists');
          console.log('============================================');
          console.log("Rendering Login from Login");
          console.log("Username exists: " + username);
          console.log('============================================');
          res.render('login', {layout: false, username: username, error: error});
        }else {
          // console.log("Doesn't exist");
          console.log('============================================');
          console.log("Redirecting to: Register from: Login");
          console.log("Username doesn't exist: " + username);
          console.log('============================================');
          req.flash('username', username);
          res.redirect('/register');
        }
      });
    }
  }
});

// Get Contact page
router.get('/contact', function(req, res){
    res.render('contact', {layout: 'dashboard-layout'});
});

// Contact feedback form
router.post('/contact', uploadNoDest.array('file'), function(req, res) {
  var name = req.body.name;
  var email = req.body.email;
  var subject = req.body.subject;
  var description = req.body.description;
  var files = req.files;

  console.log("name: " + name);
  console.log("email: " + email);
  console.log("subject: " + subject);
  console.log("description: " + description);

  if (!name || !email || !subject || JSON.parse(description)[0].insert == "\n") {
    res.end();
    return;
  }


  // For generating quill HTML
  var converter = new QuillDeltaToHtmlConverter(JSON.parse(description), {});
  // var imageCounter = 0;

  converter.afterRender(function(groupType, htmlString){
    htmlString = htmlString.replace(/<pre>/g, "<pre style='background-color: #23241f;color: #f8f8f2;overflow: visible;white-space: pre-wrap;margin-bottom: 5px;margin-top: 5px;padding: 5px 10px;border-radius: 3px;'>");

    htmlString = htmlString.replace(/<img([\w\W]+?)>/g, function() {
      return "<strong>[Imaged inserted]</strong>"
      // return `<img src='http://codeassist.org/mentor/history/${pPost._id}/image/${imageCounter++}'/>`
    });

    return htmlString;
  });

  var quillHTML = converter.convert();

  var attachments = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    attachments.push({
      content: Buffer.from(file.buffer).toString('base64'),
      filename: file.originalname,
      type: file.mimetype,
      disposition: 'attachment'
    });
  }

  User.UserSchema.find({title: "mentor"}, function(err, mentors) {
      for (var i = 0; i < mentors.length; i++) {
        var mentor = mentors[i];

        console.log('============================================');
        console.log("Sending Email ...");
        console.log(i+1 + ". Mentor Name: " + mentor.username);
        console.log(i+1 + ". Mentor Email: " + mentor.email);
        console.log('============================================');

        const output = `
          <p>Hi ${mentor.username},</p>
          <p>A user recently left feedback through the contact page.</p>
          <h2>Feedback Details</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr>
          ${quillHTML}
        `;

        const msg = {
          to: mentor.email,
          from: `Code Assist <${process.env.SENDER_EMAIL}>`,
          subject: 'Code Assist Feedback | ' + subject,
          html: output,
          attachments: attachments
        };
        sgMail.send(msg);
      }
  });

  res.send(true);
});

// Register
router.get('/register', function(req, res){
    if(req.user) {
      res.redirect('/');
    }else{
      res.render('register', {layout: false, username: req.flash('username')});
    }
});

router.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/login');
});

router.get('/dashboard', function(req, res) {
  if(req.user)
  {
    res.render('dashboard', {layout: 'dashboard-layout'});
  }else{
    req.flash('origin');
    req.flash('origin', '/dashboard');
    res.redirect('login');
  }
});

router.post('/dashboard', function(req, res) {
    if(req.user) {
      console.log("User is redirected to: Dashboard from: index");
      res.render('dashboard', {layout: 'dashboard-layout'});
    }else {
      // console.log(req.body.username);
      // console.log("User not logged in");
      console.log('============================================');
      console.log("User is redirected to: Login from: Dashboard");
      console.log("Username: " + req.body.username);
      console.log('============================================');
      req.flash('username');
      req.flash('username', req.body.username);
      req.flash('origin');
      req.flash('origin', '/dashboard');
      res.redirect('/login');
    }
});

// Register User
router.post('/register', function(req, res){
  var username = req.body.username;
  var email = req.body.email;
  var password = req.body.password;

  // req.checkBody('email', 'Email is required').notEmpty();
  // var CS_Class = req.body.CS_class;
  req.checkBody('username', 'Username is required').len(3);

  req.checkBody('email', 'Email is invalid').isEmail();
  req.checkBody('password', 'Password must be at least 8 characters long').len(8);
  req.checkBody('password', 'Password can\'t be longer than 128 characters').not().len(128);

  var errors = req.validationErrors(true);

  var newUser = new User.UserSchema({
    username: username,
    email: email,
    password: password,
    title: 'user',
    pic: "https://github.com/identicons/"+ username + ".png"
  });

  // var check = new RegExp();
  // console.log("Match: " + /^[a-z0-9]+$/.test(username));
  var passwordMatch = req.body.password2 == password;

  try{
    User.getUserByUsername(username, function(err, userWithUsername) {
      User.getUserByEmail(email, function(err, userWithEmail) {
        if (!passwordMatch || userWithUsername || userWithEmail || errors) {
          console.log('============================================');
          if (userWithEmail) console.log("Email taken");
          if (userWithUsername) console.log("Username taken");
          console.log("Redirecting to: Register from: Register");
          console.log('============================================');
          res.render('register', {layout: false, username: username, email: email, usernameTaken: userWithUsername, emailTaken: userWithEmail, notMatch: !passwordMatch});
        } else {
          User.createUser(newUser, function(err, user){
            if(err) throw err;
            // console.log('--------------------------------------------');
            // console.log('User Created ->')
            // console.log(user);
            // console.log('--------------------------------------------');
            // console.log('');
            // req.user = true;
            console.log('============================================');
            console.log("Registering New User");
            console.log("Redirecting to: Login from: Register");
            console.log('============================================');
            req.flash('username');
            req.flash('username', username);
            res.redirect('/login');
            // console.log(req.user);
          });
        }
      });
    });
  } catch(e){
    console.log('============================================');
    console.log("Register page has invalid characters");
    console.log("Redirecting to: Register from: Register");
    console.log('============================================');
    res.render('register', {layout: false, username: username, email: email, invalidChars: true});
  }
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.getUserByUsername(username, function(err, user) {
      if(err) throw err;
      if(!user) {
        return done(null, false);
        // console.log("Unknown user");
      }
      User.comparePassword(password, user.password, function(err, isMatch) {
        if(err) throw err;
        if(isMatch) {
          return done(null, user);
        }else{
          return done(null, false);
          // console.log("Invalid pass");
        }
      });
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.getUserById(id, function(err, user) {
    done(err, user);
  });
});

router.post('/login',
 	passport.authenticate('local', {failureRedirect: '/login', failureFlash: 'Invalid login'}),
    function(req, res) {
    // console.log(req.body.username);
    var origin = req.flash('origin');
    if(!origin || origin == '')
    {
      res.redirect('/');
    }else{
      res.redirect(origin);
    }
});

router.get('/account', function(req, res) {
  if(req.user) {
    var data = req.flash('account-status');
    if(data[0])
    {
      if(data[0].status == false)
      {
        // console.log("Sending password errors");
        // console.log(data[0].msg);
        res.render('account', {layout: 'dashboard-layout', error: data[0], user: req.user});
      }else{
        // console.log("No errors");
        // console.log(data[0].msg);
        res.render('account', {layout: 'dashboard-layout', success: data[0], user: req.user});
      }

    }else{
      res.render('account', {layout: 'dashboard-layout', user: req.user});
    }
  }else{
    req.flash('origin');
    req.flash('origin', '/account');
    res.redirect('/login');
  }
});

router.post('/username-change', function(req, res) {
  if(req.user)
  {
    var username = req.body.username;
    if(username.length >= 3)
    {
      if(username == req.user.username)
      {
        res.send({status: true});
      }else{
        User.UserSchema.findOne({username: username}, function(err, user) {
          if(user)
          {
            // console.log("Username Exists :(");
            res.send({status: false});
          }else{

            // console.log("Username Doesn't Exist! :)");
            req.user.username = username;
            // console.log(req.user.username);
/*              User.PostSchema.find({authorid:req.user._id},function(err,posts){
                for(var oof=0;oof<posts.length;oof++){
                  posts[oof].author=username;
                  posts[oof].save(function (err) {
                    if (err) throw err;
                    // saved!
                  });
                }
              });*/
            req.user.save(function (err) {
              if (err) throw err;
              // saved!
            });
            res.send({status: true});
          }
        });

      }

    }else{
      res.send({status: false});
    }
  }else{
    req.flash('origin');
    req.flash('origin', '/account');
    res.send({url: '/login'});
  }
});

router.post('/profile-pic-change', profilePicUpload.single('file'), function(req, res) {
  // console.log("profile pic change");
  // console.log(req.file);
  if(req.user)
  {
    User.UserSchema.findOne({_id: req.user._id}, function(err, user) {
      if (user.pic && user.pic.split("/profilePic/")[1]) {
        var fileID = new mongoose.mongo.ObjectId(user.pic.split("/profilePic/")[1]);
        gfs.exist({_id: fileID, root: 'profilePics'}, function (err, found) {
          if (err) throw err;
          if (found) {
            gfs.remove({_id: fileID, root: 'profilePics'}, function (err) {
              if (err) throw err;
            });      
          }
        });
      }

      if (req.file) {
        user.pic = '/profilePic/' + req.file.id;
      } else {
        user.pic = "https://github.com/identicons/"+ user.username + ".png"
      }

      res.send({pic: user.pic});

      user.save(function (err) {
        if (err) throw err;
      });
    });
  }else{
    req.flash('origin');
    req.flash('origin', '/account');
    res.send({url: '/login'});
  }
});

router.get('/profilePic/:fileID', (req, res) => {
  // converts fileID into object id
  // allows for file searching by _id
  var fileID = new mongoose.mongo.ObjectId(req.params.fileID);
  gfs.collection('profilePics').findOne({_id: fileID}, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

    const readstream = gfs.createReadStream(file.filename);
    readstream.pipe(res);
  });
});

router.post('/email-change', function(req, res) {
  if(req.user)
  {
    var email = req.body.email;
    req.checkBody('email', 'Email is invalid').isEmail();
    var errors = req.validationErrors(true);

    if(errors)
    {
      res.send({status: false});
    }else{
      if(email == req.user.email)
      {
        res.send({status: true});
      }else{
        User.UserSchema.findOne({email: email}, function(err, user) {
          if(user)
          {
            // console.log("Email Exists :(");
            res.send({status: false});
          }else{
            // console.log("Email Doesn't Exist! :)");
            req.user.email = email;
            // console.log(req.user.email);
            req.user.save(function (err) {
              if (err) throw err;
              // saved!
            });
            res.send({status: true});
          }
        });
      }
    }
  }else{
    req.flash('origin');
    req.flash('origin', '/account');
    res.send({url: '/login'});
  }
});

router.post('/password-change', function(req, res) {
  if(req.user)
  {
    var old = req.body.oldPass;
    var newPass = req.body.newPass;
    var conf = req.body.confPass;
    req.checkBody('newPass', 'Password must be at least 8 characters long').len(8);
    req.checkBody('newPass', 'Password can\'t be longer than 128 characters').not().len(128);

    var errors = req.validationErrors(true);
    var sendData = {
      status: true,
      msg: []
    };

    if(errors)
    {
      // console.log("Express validator errors");
      sendData.status = false;
      sendData.msg.push('Invalid Password!');
    }

    if (newPass != conf)
    {
      sendData.status = false;
      sendData.msg.push("Passwords don't match");
    }

    User.comparePassword(old, req.user.password, function(err, match) {
      if(err) throw err;
      if(Boolean(sendData.status) == true)
      {
        if(match == true)
        {
          // console.log("Saving new password");
          User.createHash(newPass, function(err, hash) {
            if(err) throw err;
            req.user.password = hash;
            req.user.save(function (err) {
              if (err) throw err;
              // saved!
            });
          });
          sendData.status = true;
          sendData.msg.push('New password saved!');
        }else{
          sendData.status = false;
          sendData.msg.push('Invalid Password!');
        }
      }
      // console.log("Login status: " + sendData.status);
      // console.log("Msg: " + sendData.msg);
      req.flash('account-status');
      req.flash('account-status', sendData);
      res.redirect('/account');
    });

  }else{
    req.flash('origin');
    req.flash('origin', '/account');
    res.redirect('/login');
  }


});

router.post('/delete-account', function(req, res) {
    if(req.user) {
      User.UserSchema.findOne({_id: req.user._id}).remove(function(err) {
        User.PostSchema.find({authorid:req.user._id}).remove(function(err){
          if(err) throw err;
          //console.log("removing users posts");
      });
        if(err) throw err;
        console.log('============================================');
        console.log('User Account Deleted');
        console.log('User is redirected to: Home from: Account');
        console.log('============================================');
        req.flash('account-deleted');
        req.flash('account-deleted', true);
        res.send("/");
      });
    }else {
      console.log('============================================');
      console.log("User is redirected to: Login from: Account");
      console.log("Username: " + req.body.username);
      console.log('============================================');
      req.flash('origin');
      req.flash('origin', '/account');
      res.redirect('/login');
    }
});

router.get('/team', function(req, res) {
  res.render('team', {layout: 'dashboard-layout'})
});

//password forget functions
router.get('/forgotpass',function(req,res){
  res.render('forgotpass',{layout:'layout'})
});

router.post('/resetpass',function(req,res){
  if(req.body.username){
//  console.log(req.body.code+"   "+req.body.username);
  User.UserSchema.findOne({username:req.body.username},function(err,user){
    if(req.body.code==user.forgotpasscode){
      console.log("let user reset their password");
      res.send("activatereset")
    }
  });
}
});

//where the actual resetting happens
router.post('/makenewpass',function(req,res){
  if(req.body.username!="undefined"){
    console.log(req.body.newpass+" "+req.body.username)
    res.send("message recieved, making new password");
      //encryption for the new password
    User.UserSchema.findOne({username:req.body.username},function(err,user){
      if(err){
        console.log(err);
      }
      bcrypt.genSalt(saltRounds, function(err, salt) {
  	     bcrypt.hash(req.body.newpass, salt, function(err, hash) {
  	        console.log(hash);
            user.password=hash;
            user.save(function(err){
              if(err){
                console.log(err);
              }
            })
  	     });
  	   });
    });

  }
});
router.post('/sendpassresetemail',function(req,res){
//  console.log(req.body.email);
  //find the user that the person is trying to pass reset
  User.UserSchema.findOne({email:req.body.email},function(err,user){
    if(err){
      console.log(err);
    }
    if(user){
      console.log("this is a valid email");

    //Generate random number to serve as the reset codeform
      var passresetnumber=Math.floor(Math.random()*9999999)+1000000;
      user.forgotpasslastattempt=new Date();
      user.forgotpasscode=passresetnumber;
      user.save(function(err){
        if(err){
          console.log(err);
        }

      res.send(user.username);

      const output = `
        <p>Hi ${user.username},</p>
        <p>Password reset</p>
        <h2>New Question Details<h2>
        <hr>
        <h3>Use This Code To Reset Your Password</h3>
        <strong><p>${passresetnumber}</p></strong>

        <h3>Contact details</h3>
        <ul>
          <li>User's Name: ${user.username}</li>
          <li>User's Email: ${user.email}</li>
        </ul>
      `;

      const forgotpassmsg={
        to:user.email,
        from: `Code Assist <${process.env.SENDER_EMAIL}>`,
        subject: 'Reset Your CodeAssist Password |',
        html: output
      }
      sgMail.send(forgotpassmsg);
      console.log("email sent to "+user.email);
    });
  }
  });
});
/*
=====================================================
                        BLOG
=====================================================
*/

// router.get('/blog', function(req, res){
//   res.render('blog', {layout: 'blog-layout'});
// })
//
// router.get('/blog/:name', function(req, res){
//   res.render(req.params.name, {layout: 'blog-layout'}, function(err){
//     if(err){
//       res.redirect('/urldoesntexist');
//     }else{
//       res.render(req.params.name, {layout: 'blog-layout'});
//     }
//   });
// });

router.get('/users/profile/:id', function(req, res) {
  var userID = req.params.id;
  if(req.user) {
    User.UserSchema.findOne({_id: userID}).populate({
      path: 'posts',
      populate: {path: 'answers'}
    }).exec(function(err, user) {
      if(err) throw err;
      if(user) {
        if(user.profile.status == "public") {
          if(req.user._id == req.params.id) {
            // user viewing himself
            res.render('user-profile', {layout: 'dashboard-layout'});
          }else{
            // someone viewing user
            var person = {
              username: user.username,
              bio: user.bio,
              pic: user.pic,
              firstName: user.first,
              lastName: user.last,
              numPosts: user.posts.length,
              qualities: user.qualities
            };

            res.render('user-profile', {layout: 'dashboard-layout', profile: person});
          }
        }else{
          res.redirect('/');
        }
      }else{
        res.redirect('/');
      }
    })
  }else{
    req.flash('origin');
    req.flash('origin', '/users/profile/'+req.params.id);
    res.redirect('/login');
  }
});

/*
=====================================================
                    DEVELOPERS
=====================================================
*/
router.get('/admin', function(req, res){
  var auth = req.flash('admin-page');
  if(auth[0] == true) {
    res.render('admin', {isAuthorized: true, layout: 'dashboard-layout'});
  }else{
    res.render('admin', {isAuthorized: (req.user) ? ((req.user.title == 'mentor') ? true : false) : false, layout: 'dashboard-layout'});
  }
});

router.post('/admin', function(req, res){
  var password = req.body.password;
  if(process.env.ADMIN_PASSWORD == password){
    req.flash('admin-page');
    req.flash('admin-page', true);
    res.send({auth: true});
  }else{
    res.send({auth: false});
  }
});

router.get('/test', function(req, res) {
  res.render('test', {layout: 'dashboard-layout'});
});

module.exports = router;
