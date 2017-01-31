require('dotenv').config()
var spotify = require('spotify-node-applescript');
var Botkit = require('botkit');

if (!process.env.SLACKTOKEN) {
  throw new Error('"SLACKTOKEN" environment variable must be defined');
}

var controller = Botkit.slackbot({
  debug: false
});

var bot = controller.spawn({
  token: process.env.SLACKTOKEN,
  retry: 10
}).startRTM()

checkTrack();

var skip = {};
var requiredSkips = 5;
var channel = process.env.CHANNEL;

var nothing = {
  'username': 'Spotify Bot',
  'icon_emoji': ':musical_note:',
  'text': "Spotify isn't playing right now..."
};

function isEmpty(obj){
  return (Object.getOwnPropertyNames(obj).length === 0);
}

function checkTrack() {
  spotify.getState(function(err, state) {
    if (err) {
      console.log(err);
      return;
    }
    if (state.state == 'playing' && !isEmpty(skip)) {
      spotify.getTrack(function(err, track) {
        if (track.id != skip.id) {
          bot.api.chat.update({
            'ts': skip.ts,
            'channel': channel,
            'text': 'The track ended before receiving enough votes.'
          }, function(err, res) {
            skip = {}
          });
        }
      });
    }
  });
  setTimeout(checkTrack, 1000 * 5);
}

function skipTrack() {
  if (skip.count == requiredSkips) {
    spotify.getState(function(err, state) {
      if (err) {
        console.log(err);
        return;
      }
      if (state.state == 'playing') {
        spotify.getTrack(function(err, track) {
          if (track.id == skip.id) {
            spotify.next(function(err, res) {
              bot.api.chat.update({
                'ts': skip.ts,
                'channel': channel,
                'text': '*' + track.name + '* by *' + track.artist + '* has been skipped by popular demand.'
              }, function(err, res) {
                skip = {}
              });
            });
          }
        });
      }
    });
  }
}

controller.on('reaction_added', function(bot, event) {
  if (event.item.ts == skip.ts) {
    if (event.reaction == '-1') {
      skip.count++;
    }
    if (event.reaction == '+1') {
      skip.count--;
    }
    skipTrack();
  }
});

controller.on('reaction_removed', function(bot, event) {
  if (event.item.ts == skip.ts) {
    if (event.reaction == '-1') {
      skip.count--;
    }
    if (event.reaction == '+1') {
      skip.count++;
    }
    skipTrack();
  }
});

controller.hears(['skip'], ['direct_message','direct_mention','mention'], function(bot, message) {
  spotify.getState(function(err, state) {
    if (err) {
      console.log(err);
      bot.reply(message, nothing);
      return;
    }
    if (state.state == 'playing') {
      spotify.getTrack(function(err, track) {
        if (track.id == skip.id) {
          var res = {
            'username': 'Spotify Bot',
            'icon_emoji': ':musical_note:',
            'text': 'A skip vote for this track is already in progress. Cast your vote to skip.'
          }
          bot.reply(message, res);
        }
        else {
          if (!isEmpty(skip)) {
            bot.api.chat.update({
              'ts': skip.ts,
              'channel': channel,
              'text': 'The track ended before receiving enough votes.'
            }, function(err, res) {
              skip = {}
            });
          }
          bot.api.chat.postMessage({
            'channel': channel,
            'username': 'Spotify Bot',
            'icon_emoji': ':musical_note:',
            'text': "A skip vote has been started for *" + track.name + "* by *" + track.artist + "*? Vote :+1: to save or :-1: to skip the track."
          }, function(err, res) {
            bot.api.reactions.add({
              'name': '-1',
              'channel': channel,
              'timestamp': res.ts
            }, function (err) {
              bot.api.reactions.add({
                'name': '+1',
                'channel': channel,
                'timestamp': res.ts
              }, function (err) {
                skip.ts = res.ts;
                skip.id = track.id;
                skip.count = 0;
              });
            });
          });
        }
      });
    }
    else {
      var res = {
        'username': 'Spotify Bot',
        'icon_emoji': ':musical_note:',
        'text': "Spotify isn't playing right now..."
      }
      bot.reply(message, res);
    }
  });
});

controller.hears(['what(\'?s| is) this song', 'what(\'?s| is) playing', 'what(\'?s| is) this track', 'what song is this', 'what music is this', 'what(\'?s| is) this music'], ['direct_message','direct_mention','mention'], function(bot, message) {
  spotify.getState(function(err, state) {
    if (err) {
      console.log(err);
      bot.reply(message, nothing);
      return;
    }
    if (state.state == 'playing') {
      spotify.getTrack(function(err, track) {
        var res = {
          'username': 'Spotify Bot',
          'icon_emoji': ':musical_note:',
          'text': 'The current track is *' + track.name + '* by *' + track.artist + '*'
        }
        bot.reply(message, res);
      });
    }
    else {
      bot.reply(message, nothing);
    }
  });
});
