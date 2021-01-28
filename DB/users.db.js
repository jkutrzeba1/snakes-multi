
var bcrypt = require("bcrypt");

var ObjectId = require('mongodb').ObjectId;

var p = require("../db.js").promise;

p.then( function(db){

  users.coll = db.collection("users");

})

var users = {

  checkCredentials: function(username, password){

    return this.coll.findOne({ username: username})
    .then( (doc)=>{
      if(!doc)
        return null;

      return bcrypt.compare(password, doc.password)
      .then((res)=>{
        if(res){
          return doc; // comparision succed
        }
        else{
          return null;
        }
      })

    })

  },

  findById: function(id){
      return this.coll.findOne({_id: ObjectId(id) });
  },


  usernameTaken: function(username){

    return this.coll.findOne( { username: username} )
    .then( (doc) => {
      if(doc){
        return true;
      }
      else{
        return false;
      }
    });

  },
  emailTaken: function(email){

    return this.coll.findOne( { email: email})
    .then( (doc) => {
      if(doc){
        return true;
      }
      else{
        return false;
      }
    });

  },

  registerUser: function(username, password, email, referrer, country_code){

    return bcrypt.hash(password, 9)
    .then((hash)=>{

      var user_to_register = {
        username: username,
        password: hash,
        email: email,
        balance_total: 12000,
        balance_withdrawal: 0,
        points: 0,
        refferals: [],
        earned_from_refs: 0,
        country_code: country_code
      };

      if(referrer){
        user_to_register.referrer = referrer;
      }

      return this.coll.insertOne( user_to_register );

    });
  },

  checkBalance: function(playername, charge){

    var reduction_obj = {
      for: playername,
      success: false,
      balance_total_reduction: 0,
      balance_withdrawal_reduction: 0
    }

    return this.coll.findOne({
      username: playername
    },
    {
      projection: {
        balance_total: 1,
        balance_withdrawal: 1
      }
    })
    .then((doc)=>{

      if(doc.balance_total>=charge){

        reduction_obj.success = true;
        reduction_obj.balance_total_reduction = charge;

        var balance_after = doc.balance_total - charge;
        // equalize balance when withdrawal exceeded total
        if(balance_after<doc.balance_withdrawal){
          reduction_obj.balance_withdrawal_reduction = doc.balance_withdrawal - balance_after;
        }
      }
      else{
        reduction_obj.success = false;
      }

      return reduction_obj;

    })

  },

  checkBalanceForWalletWithdrawal: function(playername, amount){

    var reduction_obj = {
      for: playername,
      success: false,
      failure_reason: "",
      balance_total_reduction: 0,
      balance_withdrawal_reduction: 0
    }

    return this.coll.findOne({
      username: playername
    },
    {
      projection: {
        balance_total: 1,
        balance_withdrawal: 1
      }
    })
    .then((doc_player)=>{

      if(doc_player.balance_withdrawal < amount){
        reduction_obj.success = false;
        reduction_obj.failure_reason = "Insufficient account balance";
        return reduction_obj;
      }

      reduction_obj.success = true;
      reduction_obj.balance_total_reduction = amount;
      reduction_obj.balance_withdrawal_reduction = amount;

      return reduction_obj;

    })

  },

  reduceBalance: function(player_name, reduction_obj){

    this.coll.updateOne(
      {
        username: player_name
      },
      {
        $inc: {
          balance_total: -reduction_obj.balance_total_reduction,
          balance_withdrawal: -reduction_obj.balance_withdrawal_reduction
        }
      }
    );

  },

  incrementBalanceForWinner: function(username, amount){

    this.coll.updateOne(
      {
        username: username
      },
      {
        $inc: {
          balance_withdrawal: amount,
          balance_total: amount
        }
      }
    );

  },

  incrementBalanceForUser: function(username, amount){

    this.coll.updateOne(
      {
        username: username
      },
      {
        $inc: {
          balance_total: parseInt(amount)
        }
      }
    );

  },

  updateRanking: function(arr_players){

    /*
      player_item.playername
      player_item.points
    */

    for(var player_item of arr_players){

      this.coll.updateOne(
        {
          username: player_item.playername
        },
        {
          $inc: {
            points: player_item.points
          }
        }
      );

    }

  },

  getRanking: function(page){

    /*
      0 -> 0 [0-19]
      1 -> 20 [20 - 39]
    */

    var skip = page*15;
    var limit = 15;

    return this.coll.find(
      {},
      {
        projection: {
          username: 1,
          points: 1,
          country_code: 1,
          _id: 0
        },
        skip: skip,
        limit: limit+1,
        sort: {
          points: -1
        }
      }
    ).toArray()
    .then((docs)=>{
      let isCurPageLast = true;

      if(docs.length === limit+1){
          docs.pop();
          isCurPageLast = false;
      }

      return {
        arr_players: docs,
        isCurPageLast: isCurPageLast
      }
    })

  },

  reduceBalanceAfterWithdrawal: function(username, amount){

    this.coll.updateOne(
      {
        username: username
      },
      {
        $inc: {
          balance_withdrawal: amount,
          balance_total: amount
        }
      }
    )

  },

  refferalGained: function(referrer, refferal){

	  this.coll.updateOne(
		{
			username: referrer,
		},
		{
			$push: {
				refferals: refferal
			}
		}

	  )

  },

  incrementBalanceForReferrer: function(referrer, amount){

	  this.coll.updateOne({
		  username: referrer
	  }, {
		  $inc: {
			  balance_total: amount,
			  balance_withdrawal: amount,
			  earned_from_refs: amount
		  }
	  })

  },

  getReferrer: function(username){

	  return this.coll.findOne({
		  username: username
	  }, {
		  projection: {
			  referrer: 1
		  }
	  })
	  .then( (doc)=>{
		if(doc){
			return doc.referrer;
		}
		return null;
	  })

  },

  getReferrerStats: function(username){

    return this.coll.aggregate(
      [
        {
          $match: {
            username: username
          },
        },
        {
          $project: {
            _id: 0,
            ref_amount: {
              $size: "$refferals"
            },
            ref_earned: "$earned_from_refs"
          }
        }
      ]
    ).next();

  }

}


module.exports = users;
