#!/usr/bin/env bash
# ==============================================================================
# ASVspoof 5 Official Dataset Resumable Downloader & Checksum Verifier
# ==============================================================================
# CERN Zenodo Record: https://zenodo.org/records/14498691
# License: Open Data Commons Attribution License (ODC-By) / CC BY 4.0
# Citation: Wang et al., "ASVspoof 5: crowdsourced speech data, deepfakes,
#           and adversarial attacks at scale", ASVspoof Workshop 2024.
# ==============================================================================

set -euo pipefail

DEST_DIR="${DATA_DIR:-data/asvspoof5_official}"
ZENODO_RECORD_ID="14498691"
BASE_URL="https://zenodo.org/api/records/${ZENODO_RECORD_ID}/files"

# Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]$(date '+%Y-%m-%d %H:%M:%S')${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]$(date '+%Y-%m-%d %H:%M:%S')${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]$(date '+%Y-%m-%d %H:%M:%S')${NC} $1" >&2
}

mkdir -p "${DEST_DIR}"

# Official CERN Zenodo MD5 Checksums (POSIX compatible lookup)
get_expected_md5() {
    case "$1" in
        ASVspoof5_protocols.tar.gz) echo "865d0e894ea9f686f0f37e5ae3ae3616" ;;
        README.txt) echo "784002b8449ba1eeecc042bfad285de7" ;;
        LICENSE.txt) echo "9cbefc63251e8cbc8eb22e62cd6fe584" ;;
        flac_D_aa.tar) echo "df0be44957623991028cce59792beb17" ;;
        flac_D_ab.tar) echo "1e8cd685d89b64502692f1bcf1a13db3" ;;
        flac_D_ac.tar) echo "5e0031f08c30e4bdbf0c59f91b2d662b" ;;
        flac_E_aa.tar) echo "a8c800766f3d4ef87971e2b4f29663e2" ;;
        flac_E_ab.tar) echo "c35064188f54f07c87aba58de22534a0" ;;
        flac_E_ac.tar) echo "ed7cbcd1b2847998b72472ddf6b445e3" ;;
        flac_E_ad.tar) echo "626a080e994b05df49c577d7b3dede8d" ;;
        flac_E_ae.tar) echo "05f19a5e64fa556714ae1b38eb2ea70b" ;;
        flac_E_af.tar) echo "2ca2f52a3bbf827f7ec155ecb47e85d6" ;;
        flac_E_ag.tar) echo "671200b5de2fc1e74a563b07b057af8f" ;;
        flac_E_ah.tar) echo "eaf885b1299a61eb07f71e82e96dba37" ;;
        flac_E_ai.tar) echo "b2625683bf440abae2af901a45542ad9" ;;
        flac_E_aj.tar) echo "c50281c8233af6f3b0899604d21ade44" ;;
        flac_T_aa.tar) echo "b0cc86b14826a7701b52aad4f53daf9c" ;;
        flac_T_ab.tar) echo "d05be3f4be7a343fdbdd0ed29fdff2e1" ;;
        flac_T_ac.tar) echo "70d1ba4ad75a20aef3dae541fbd321e3" ;;
        flac_T_ad.tar) echo "c9bb56af2cc410d98338d74babcb95c9" ;;
        flac_T_ae.tar) echo "a3969816982f3e52300d6147ad796df7" ;;
        *) echo "" ;;
    esac
}

compute_md5() {
    local target="$1"
    if command -v md5sum >/dev/null 2>&1; then
        md5sum "${target}" | awk '{print $1}'
    elif command -v md5 >/dev/null 2>&1; then
        md5 -q "${target}"
    else
        python3 -c "import hashlib, sys; print(hashlib.md5(open(sys.argv[1], 'rb').read()).hexdigest())" "${target}"
    fi
}

download_and_verify_file() {
    local filename="$1"
    local expected_md5
    expected_md5=$(get_expected_md5 "$filename")
    local target_path="${DEST_DIR}/${filename}"
    local download_url="${BASE_URL}/${filename}/content"

    if [[ -f "${target_path}" ]]; then
        log_info "Verifying existing file: ${filename}"
        local current_md5
        current_md5=$(compute_md5 "${target_path}")
        if [[ "${current_md5}" == "${expected_md5}" ]]; then
            log_success "Checksum verified for ${filename}: ${current_md5}"
            return 0
        else
            log_error "Checksum mismatch on existing file: expected ${expected_md5}, got ${current_md5}. Resuming download..."
        fi
    fi

    log_info "Downloading ${filename} from ${download_url}..."
    if command -v wget >/dev/null 2>&1; then
        wget -c -t 10 --waitretry=5 --timeout=60 -O "${target_path}" "${download_url}"
    else
        curl -C - -L --retry 10 --retry-delay 5 --connect-timeout 60 -o "${target_path}" "${download_url}"
    fi

    log_info "Verifying MD5 checksum for ${filename}..."
    local post_md5
    post_md5=$(compute_md5 "${target_path}")
    if [[ "${post_md5}" == "${expected_md5}" ]]; then
        log_success "Checksum MATCHED for ${filename} (${post_md5})"
    else
        log_error "Checksum verification FAILED for ${filename}: expected ${expected_md5}, got ${post_md5}"
        return 1
    fi
}

extract_archive() {
    local filename="$1"
    local archive_path="${DEST_DIR}/${filename}"
    log_info "Extracting ${filename} into ${DEST_DIR}..."
    if [[ "${filename}" == *.tar.gz ]]; then
        tar -xzf "${archive_path}" -C "${DEST_DIR}"
    elif [[ "${filename}" == *.tar ]]; then
        tar -xf "${archive_path}" -C "${DEST_DIR}"
    fi
    log_success "Extracted ${filename}"
}

usage() {
    cat << EOF
Usage: $0 [OPTION]

Download official ASVspoof 5 archives from CERN Zenodo with checksum verification.

Options:
  --protocols    Download protocols metadata (20.6 MB) and docs (README/LICENSE)
  --dev          Download development set (flac_D_aa to flac_D_ac, ~18.7 GB)
  --eval         Download evaluation set (flac_E_aa to flac_E_aj, ~78.8 GB)
  --train        Download training set (flac_T_aa to flac_T_ae, ~35.0 GB)
  --all          Download entire corpus (~132.5 GB)
  --extract      Extract downloaded archives after verification
  --help         Show this help message

Environment variables:
  DATA_DIR       Destination folder (default: data/asvspoof5_official)

EOF
}

TARGET="protocols"
DO_EXTRACT=false

for arg in "$@"; do
    case "$arg" in
        --protocols) TARGET="protocols" ;;
        --dev) TARGET="dev" ;;
        --eval) TARGET="eval" ;;
        --train) TARGET="train" ;;
        --all) TARGET="all" ;;
        --extract) DO_EXTRACT=true ;;
        --help|-h) usage; exit 0 ;;
        *) log_error "Unknown argument: $arg"; usage; exit 1 ;;
    esac
done

# Always download metadata docs
download_and_verify_file "README.txt"
download_and_verify_file "LICENSE.txt"

FILES_TO_DOWNLOAD=()

if [[ "$TARGET" == "protocols" || "$TARGET" == "all" ]]; then
    FILES_TO_DOWNLOAD+=("ASVspoof5_protocols.tar.gz")
fi

if [[ "$TARGET" == "dev" || "$TARGET" == "all" ]]; then
    FILES_TO_DOWNLOAD+=("flac_D_aa.tar" "flac_D_ab.tar" "flac_D_ac.tar")
fi

if [[ "$TARGET" == "eval" || "$TARGET" == "all" ]]; then
    FILES_TO_DOWNLOAD+=(
        "flac_E_aa.tar" "flac_E_ab.tar" "flac_E_ac.tar" "flac_E_ad.tar"
        "flac_E_ae.tar" "flac_E_af.tar" "flac_E_ag.tar" "flac_E_ah.tar"
        "flac_E_ai.tar" "flac_E_aj.tar"
    )
fi

if [[ "$TARGET" == "train" || "$TARGET" == "all" ]]; then
    FILES_TO_DOWNLOAD+=(
        "flac_T_aa.tar" "flac_T_ab.tar" "flac_T_ac.tar"
        "flac_T_ad.tar" "flac_T_ae.tar"
    )
fi

log_info "Target set: ${TARGET}. Total archives to download: ${#FILES_TO_DOWNLOAD[@]}"

for fn in "${FILES_TO_DOWNLOAD[@]}"; do
    download_and_verify_file "${fn}"
    if [[ "${DO_EXTRACT}" == true ]]; then
        extract_archive "${fn}"
    fi
done

log_success "All requested ASVspoof 5 archives processed successfully in ${DEST_DIR}."
