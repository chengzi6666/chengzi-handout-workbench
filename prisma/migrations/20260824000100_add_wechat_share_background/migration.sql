-- Separate the A4 flipbook cover from the horizontal social-share card image.
ALTER TYPE "BackgroundRole" ADD VALUE IF NOT EXISTS 'WECHAT_SHARE';
