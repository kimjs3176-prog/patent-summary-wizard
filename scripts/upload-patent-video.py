"""특허 기술소개영상을 Cloudflare R2에 올리는 스크립트 (로컬 PC에서 실행).

준비: pip install boto3
환경변수: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET(기본 patent-tech-videos)
사용:   python scripts/upload-patent-video.py 10-2024-0012345 영상.mp4 [썸네일.jpg]
"""
import os
import re
import sys

import boto3


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    key = re.sub(r"\D", "", sys.argv[1])
    if len(key) < 10:
        sys.exit("특허번호가 올바르지 않습니다.")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    bucket = os.environ.get("R2_BUCKET", "patent-tech-videos")
    s3.upload_file(sys.argv[2], bucket, f"patents/{key}.mp4",
                   ExtraArgs={"ContentType": "video/mp4", "CacheControl": "public, max-age=604800"})
    if len(sys.argv) > 3:
        s3.upload_file(sys.argv[3], bucket, f"patents/{key}.jpg",
                       ExtraArgs={"ContentType": "image/jpeg", "CacheControl": "public, max-age=604800"})
    print(f"업로드 완료: patents/{key}.mp4")


if __name__ == "__main__":
    main()
