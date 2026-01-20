-- VEX Platform Achievements
-- إنجازات منصة VEX

-- Gaming Achievements (إنجازات الألعاب)
INSERT INTO achievements (key, name_en, name_ar, description_en, description_ar, category, rarity, game_type, requirement, reward_amount, icon_name, sort_order) VALUES
-- Chess Achievements
('chess_first_win', 'First Victory', 'أول انتصار', 'Win your first chess game', 'اربح أول مباراة شطرنج', 'games', 'common', 'chess', 1, 10.00, 'trophy', 1),
('chess_win_streak_3', 'Triple Crown', 'التاج الثلاثي', 'Win 3 chess games in a row', 'اربح 3 مباريات شطرنج متتالية', 'gaming', 'uncommon', 'chess', 3, 25.00, 'crown', 2),
('chess_win_streak_5', 'Chess Master', 'سيد الشطرنج', 'Win 5 chess games in a row', 'اربح 5 مباريات شطرنج متتالية', 'gaming', 'rare', 'chess', 5, 50.00, 'star', 3),
('chess_wins_10', 'Chess Enthusiast', 'عاشق الشطرنج', 'Win 10 chess games', 'اربح 10 مباريات شطرنج', 'gaming', 'uncommon', 'chess', 10, 30.00, 'medal', 4),
('chess_wins_50', 'Chess Expert', 'خبير الشطرنج', 'Win 50 chess games', 'اربح 50 مباراة شطرنج', 'gaming', 'rare', 'chess', 50, 100.00, 'award', 5),
('chess_wins_100', 'Chess Legend', 'أسطورة الشطرنج', 'Win 100 chess games', 'اربح 100 مباراة شطرنج', 'gaming', 'legendary', 'chess', 100, 250.00, 'gem', 6),
('chess_checkmate_fast', 'Speed Demon', 'شيطان السرعة', 'Checkmate in under 15 moves', 'كش ملك في أقل من 15 حركة', 'gaming', 'rare', 'chess', 1, 75.00, 'lightning', 7),

-- Domino Achievements
('domino_first_win', 'Domino Debut', 'بداية الدومينو', 'Win your first domino game', 'اربح أول مباراة دومينو', 'gaming', 'common', 'domino', 1, 10.00, 'trophy', 10),
('domino_win_streak_3', 'Domino Streak', 'سلسلة الدومينو', 'Win 3 domino games in a row', 'اربح 3 مباريات دومينو متتالية', 'gaming', 'uncommon', 'domino', 3, 25.00, 'fire', 11),
('domino_wins_25', 'Domino Pro', 'محترف الدومينو', 'Win 25 domino games', 'اربح 25 مباراة دومينو', 'gaming', 'rare', 'domino', 25, 60.00, 'star', 12),
('domino_wins_100', 'Domino Master', 'سيد الدومينو', 'Win 100 domino games', 'اربح 100 مباراة دومينو', 'gaming', 'legendary', 'domino', 100, 200.00, 'crown', 13),

-- Backgammon Achievements
('backgammon_first_win', 'First Backgammon', 'أول طاولة', 'Win your first backgammon game', 'اربح أول مباراة طاولة', 'gaming', 'common', 'backgammon', 1, 10.00, 'trophy', 20),
('backgammon_win_streak_5', 'Backgammon King', 'ملك الطاولة', 'Win 5 backgammon games in a row', 'اربح 5 مباريات طاولة متتالية', 'gaming', 'rare', 'backgammon', 5, 50.00, 'crown', 21),
('backgammon_wins_50', 'Backgammon Expert', 'خبير الطاولة', 'Win 50 backgammon games', 'اربح 50 مباراة طاولة', 'gaming', 'rare', 'backgammon', 50, 100.00, 'medal', 22),

-- Baloot Achievements
('baloot_first_win', 'Baloot Beginner', 'مبتدئ البلوت', 'Win your first baloot game', 'اربح أول مباراة بلوت', 'gaming', 'common', 'baloot', 1, 10.00, 'trophy', 30),
('baloot_wins_20', 'Baloot Player', 'لاعب البلوت', 'Win 20 baloot games', 'اربح 20 مباراة بلوت', 'gaming', 'uncommon', 'baloot', 20, 40.00, 'cards', 31),
('baloot_wins_100', 'Baloot Champion', 'بطل البلوت', 'Win 100 baloot games', 'اربح 100 مباراة بلوت', 'gaming', 'legendary', 'baloot', 100, 250.00, 'gem', 32),

-- Tarneeb Achievements
('tarneeb_first_win', 'Tarneeb Start', 'بداية الطرنيب', 'Win your first tarneeb game', 'اربح أول مباراة طرنيب', 'gaming', 'common', 'tarneeb', 1, 10.00, 'trophy', 40),
('tarneeb_wins_30', 'Tarneeb Master', 'سيد الطرنيب', 'Win 30 tarneeb games', 'اربح 30 مباراة طرنيب', 'gaming', 'rare', 'tarneeb', 30, 80.00, 'star', 41),

-- Hand Achievements
('hand_first_win', 'Hand Champion', 'بطل الهاند', 'Win your first hand game', 'اربح أول مباراة هاند', 'gaming', 'common', 'hand', 1, 10.00, 'trophy', 50),
('hand_wins_25', 'Hand Expert', 'خبير الهاند', 'Win 25 hand games', 'اربح 25 مباراة هاند', 'gaming', 'rare', 'hand', 25, 65.00, 'medal', 51),

-- Multi-Game Achievements
('multi_game_player', 'Multi-Gamer', 'لاعب متعدد', 'Win games in 3 different game types', 'اربح في 3 أنواع ألعاب مختلفة', 'gaming', 'uncommon', NULL, 3, 40.00, 'gamepad', 60),
('game_master', 'Game Master', 'سيد الألعاب', 'Win games in all game types', 'اربح في جميع أنواع الألعاب', 'gaming', 'legendary', NULL, 7, 300.00, 'crown', 61),
('total_wins_50', 'Winner', 'الفائز', 'Win 50 games total', 'اربح 50 مباراة إجمالية', 'gaming', 'uncommon', NULL, 50, 80.00, 'trophy', 62),
('total_wins_200', 'Champion', 'البطل', 'Win 200 games total', 'اربح 200 مباراة إجمالية', 'gaming', 'rare', NULL, 200, 200.00, 'medal', 63),
('total_wins_500', 'Legend', 'الأسطورة', 'Win 500 games total', 'اربح 500 مباراة إجمالية', 'gaming', 'legendary', NULL, 500, 500.00, 'gem', 64),

-- Trading Achievements (إنجازات التداول)
('first_trade', 'First Trade', 'أول صفقة', 'Complete your first P2P trade', 'أكمل أول صفقة P2P', 'trading', 'common', NULL, 1, 15.00, 'handshake', 100),
('trades_10', 'Trader', 'المتداول', 'Complete 10 P2P trades', 'أكمل 10 صفقات P2P', 'trading', 'uncommon', NULL, 10, 30.00, 'briefcase', 101),
('trades_50', 'Expert Trader', 'المتداول الخبير', 'Complete 50 P2P trades', 'أكمل 50 صفقة P2P', 'trading', 'rare', NULL, 50, 100.00, 'chart', 102),
('trades_200', 'Trading Master', 'سيد التداول', 'Complete 200 P2P trades', 'أكمل 200 صفقة P2P', 'trading', 'legendary', NULL, 200, 300.00, 'diamond', 103),
('trade_volume_1000', 'High Roller', 'صاحب الرهان الكبير', 'Trade over $1000 in volume', 'تداول بأكثر من 1000$ إجمالي', 'trading', 'rare', NULL, 1000, 150.00, 'money', 104),
('trade_volume_10000', 'Whale Trader', 'الحوت', 'Trade over $10,000 in volume', 'تداول بأكثر من 10000$ إجمالي', 'trading', 'legendary', NULL, 10000, 500.00, 'whale', 105),

-- Social Achievements (الإنجازات الاجتماعية)
('first_friend', 'Social Starter', 'البداية الاجتماعية', 'Add your first friend', 'أضف أول صديق', 'social', 'common', NULL, 1, 5.00, 'users', 200),
('friends_10', 'Popular', 'الشعبي', 'Have 10 friends', 'احصل على 10 أصدقاء', 'social', 'uncommon', NULL, 10, 20.00, 'heart', 201),
('friends_50', 'Social Butterfly', 'الفراشة الاجتماعية', 'Have 50 friends', 'احصل على 50 صديق', 'social', 'rare', NULL, 50, 75.00, 'smile', 202),
('chat_messages_100', 'Chatterbox', 'الثرثار', 'Send 100 chat messages', 'أرسل 100 رسالة محادثة', 'social', 'uncommon', NULL, 100, 15.00, 'message', 203),
('challenge_creator', 'Challenge Master', 'سيد التحديات', 'Create 10 challenges', 'أنشئ 10 تحديات', 'social', 'uncommon', NULL, 10, 30.00, 'zap', 204),
('spectator_pro', 'Spectator', 'المشاهد', 'Watch 25 games', 'شاهد 25 مباراة', 'social', 'uncommon', NULL, 25, 20.00, 'eye', 205),

-- Progression Achievements (إنجازات التقدم)
('level_10', 'Rising Star', 'النجم الصاعد', 'Reach level 10', 'اوصل للمستوى 10', 'progression', 'common', NULL, 10, 25.00, 'star', 300),
('level_25', 'Experienced', 'صاحب الخبرة', 'Reach level 25', 'اوصل للمستوى 25', 'progression', 'uncommon', NULL, 25, 60.00, 'award', 301),
('level_50', 'Veteran', 'المخضرم', 'Reach level 50', 'اوصل للمستوى 50', 'progression', 'rare', NULL, 50, 150.00, 'shield', 302),
('level_100', 'Elite', 'النخبة', 'Reach level 100', 'اوصل للمستوى 100', 'progression', 'legendary', NULL, 100, 500.00, 'crown', 303),
('daily_login_7', 'Week Warrior', 'محارب الأسبوع', 'Login 7 days in a row', 'سجل دخول 7 أيام متتالية', 'progression', 'common', NULL, 7, 20.00, 'calendar', 304),
('daily_login_30', 'Monthly Master', 'سيد الشهر', 'Login 30 days in a row', 'سجل دخول 30 يوم متتالية', 'progression', 'rare', NULL, 30, 100.00, 'fire', 305),
('daily_login_365', 'Year Legend', 'أسطورة السنة', 'Login 365 days in a row', 'سجل دخول 365 يوم متتالية', 'progression', 'legendary', NULL, 365, 1000.00, 'gem', 306),

-- Special Achievements (إنجازات خاصة)
('early_adopter', 'Early Adopter', 'المستخدم الأول', 'Join VEX in the first month', 'انضم لـ VEX في الشهر الأول', 'special', 'rare', NULL, 1, 100.00, 'gift', 400),
('beta_tester', 'Beta Tester', 'مختبر البيتا', 'Participate in beta testing', 'شارك في اختبار البيتا', 'special', 'rare', NULL, 1, 150.00, 'bug', 401),
('vip_member', 'VIP Member', 'عضو VIP', 'Become a VIP member', 'أصبح عضو VIP', 'special', 'legendary', NULL, 1, 500.00, 'star', 402),
('tournament_winner', 'Tournament Champion', 'بطل البطولة', 'Win a tournament', 'اربح بطولة', 'special', 'legendary', NULL, 1, 1000.00, 'trophy', 403),
('perfect_week', 'Perfect Week', 'الأسبوع المثالي', 'Win every game in a week', 'اربح كل مباراة في أسبوع', 'special', 'rare', NULL, 1, 200.00, 'star', 404),
('comeback_king', 'Comeback King', 'ملك العودة', 'Win after being behind by 50+ points', 'اربح بعد التأخر بـ 50+ نقطة', 'special', 'rare', NULL, 1, 150.00, 'zap', 405);
